---
name: paper-embedded-http
description: "在 Paper 插件內以 JDK HttpServer 提供唯讀 JSON／靜態頁面：預設只綁 127.0.0.1、有界 daemon 執行緒池、handler 零 Bukkit 呼叫（主執行緒定時發布不可變快照）、每 IP token bucket 限流 / Read-only JSON and static page endpoint inside a Paper plugin using the JDK HttpServer with loopback bind, bounded daemon pool, main-thread snapshots and per-IP rate limiting"
---

# Paper Embedded HTTP

## Skill Name

`paper-embedded-http`

## Purpose

Let a plugin expose a small **read-only** web page or JSON API (leaderboards, market prices, online player count) with no extra dependencies: it uses the JDK's built-in `com.sun.net.httpserver.HttpServer` and the Gson bundled with paper-api.

Core design:

- **Handlers never call the Bukkit API.** Bukkit is not thread-safe; HTTP threads only read an immutable snapshot that the main thread rebuilds periodically and replaces as a whole (`AtomicReference`).
- Always respond **503** until the first snapshot exists.
- Binds only to `127.0.0.1` by default; to expose it publicly, put a reverse proxy (nginx/Caddy, see `examples.md`) in front, and let the proxy handle TLS and external rate limiting.
- A dedicated, bounded daemon thread pool; never use `ForkJoinPool.commonPool()`.
- Per-IP token bucket rate limiting; `X-Forwarded-For` is honored only when the request comes from a configured **trusted proxy**.
- If the port is already in use, log a warning and **disable only this feature**; the rest of the plugin keeps working.

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (uses only the JDK `jdk.httpserver` module, Gson, and the Bukkit scheduler; identical on both versions)
- Pure Paper API; Paperweight is not required
- `com.sun.net.httpserver` belongs to the `jdk.httpserver` module, which ships with the Paper server's JRE; no extra Gradle configuration is needed to compile

## Triggers

- "內嵌 HTTP", "embedded HTTP server", "HttpServer", "web API", "JSON API"
- "排行榜網頁", "網頁面板", "status page", "REST endpoint"
- "限流", "rate limit", "token bucket", "X-Forwarded-For", "反向代理", "CORS"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `base_package` | `com.example.web` | Package that holds the HTTP classes |
| `bind` | `127.0.0.1` | Bind address; for public access keep loopback and add a reverse proxy |
| `port` | `8080` | Listening port |
| `routes` | `/api/players` | Read-only paths to expose (one `SnapshotStore` per path) |
| `refresh_ticks` | `100` | Interval at which the main thread rebuilds the snapshot |
| `static_resource` | `web/index.html` | Optional: static page bundled in the jar |

## Outputs

- `WebConfig.java` - Immutable config record (parsed once at startup)
- `SnapshotStore.java` - Publishes JSON snapshots through an `AtomicReference`
- `RateLimiter.java` - Per-IP token bucket (time is a parameter, so it can be tested without sleeping)
- `ClientAddress.java` - Resolves the client IP (`X-Forwarded-For` is only read for trusted proxies)
- `Responses.java` - Fixed headers, optional CORS, HEAD handling, error JSON
- `RequestGuard.java` - Method gate (405) and rate limiting (429)
- `JsonHandler.java` - Serves the snapshot (503/304/200)
- `StaticPageHandler.java` - Optional: serves a static page from the jar (BOM stripped)
- `EmbeddedHttpServer.java` - Lifecycle: bind, thread pool, stop
- `PlayersSnapshotTask.java` - Example main-thread task that builds a snapshot
- `WebPlugin.java` - Wiring: start in `onEnable`, shut down cleanly in `onDisable`
- `config.yml` snippet

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). No new dependencies are needed; Gson is provided transitively by `paper-api` (the server also bundles it; do not shade it).

`config.yml`:

```yaml
web:
  enabled: false              # Disabled by default; enable after confirming bind/port
  bind: 127.0.0.1             # For public access use a reverse proxy; do not just change this to 0.0.0.0
  port: 8080
  threads: 2                  # Number of handler threads (fixed upper bound)
  rate-limit-per-minute: 120  # Per IP; 0 = no rate limiting
  trusted-proxies: []         # e.g. ["127.0.0.1"]; X-Forwarded-For is honored only for requests from these addresses
  cors-origin: ""             # Empty string = send no CORS headers; "*" or a single origin = enabled
  cache-seconds: 5            # Cache-Control: public, max-age
  refresh-ticks: 100          # Interval at which the main thread rebuilds the snapshot (20 ticks = 1 second)
```

## Code Template

### `WebConfig.java`

```java
package com.example.web;

import org.bukkit.configuration.ConfigurationSection;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Immutable web config. Parsed once at startup; changing bind/port/enabled requires a restart, and reload does not rebind. */
public record WebConfig(
    boolean enabled,
    String bind,
    int port,
    int threads,
    int ratePerMinute,
    Set<String> trustedProxies,
    String corsOrigin,
    int cacheSeconds,
    int refreshTicks
) {

    public static final String DEFAULT_BIND = "127.0.0.1";
    private static final int DEFAULT_PORT = 8080;
    private static final int MAX_THREADS = 8;

    public WebConfig {
        trustedProxies = Set.copyOf(trustedProxies);
    }

    /** Missing keys always fall back to safe defaults (disabled, loopback). */
    public static WebConfig from(ConfigurationSection section) {
        if (section == null) {
            return new WebConfig(false, DEFAULT_BIND, DEFAULT_PORT, 2, 120, Set.of(), "", 5, 100);
        }
        String bind = section.getString("bind", DEFAULT_BIND).trim();
        int port = section.getInt("port", DEFAULT_PORT);
        List<String> proxies = section.getStringList("trusted-proxies");
        return new WebConfig(
            section.getBoolean("enabled", false),
            bind.isEmpty() ? DEFAULT_BIND : bind,
            port < 1 || port > 65535 ? DEFAULT_PORT : port,
            Math.min(MAX_THREADS, Math.max(1, section.getInt("threads", 2))),
            Math.max(0, section.getInt("rate-limit-per-minute", 120)),
            new HashSet<>(proxies),
            section.getString("cors-origin", "").trim(),
            Math.max(0, section.getInt("cache-seconds", 5)),
            Math.max(20, section.getInt("refresh-ticks", 100))
        );
    }
}
```

### `SnapshotStore.java`

```java
package com.example.web;

import com.google.gson.Gson;
import com.google.gson.JsonElement;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import java.util.zip.CRC32;

/**
 * The main thread builds the JSON, converts it to UTF-8 bytes, and replaces the whole snapshot; HTTP threads only read {@link #current()}.
 * One instance per route (not a static singleton). The byte array inside a snapshot must not be modified after publishing.
 */
public final class SnapshotStore {

    /** Serialized JSON (UTF-8, no BOM), ETag, and build time. */
    public record Snapshot(byte[] body, String etag, long builtAtMillis) {
    }

    // A Gson instance is thread-safe and immutable; by default it escapes < > & ', so embedding in HTML is safe too.
    private static final Gson GSON = new Gson();

    // null until the first snapshot is published (handlers respond 503).
    private final AtomicReference<Snapshot> ref = new AtomicReference<>();

    /** Called on the main thread: serialize and publish. Gson handles string escaping; do not concatenate JSON yourself. */
    public void publish(JsonElement json, long nowMillis) {
        byte[] body = GSON.toJson(json).getBytes(StandardCharsets.UTF_8);
        CRC32 crc = new CRC32();
        crc.update(body);
        String etag = "\"" + Long.toHexString(crc.getValue()) + "-" + Integer.toHexString(body.length) + "\"";
        ref.set(new Snapshot(body, etag, nowMillis));
    }

    /** Any thread; returns null if nothing has been published yet. */
    public Snapshot current() {
        return ref.get();
    }
}
```

### `RateLimiter.java`

```java
package com.example.web;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * One token bucket per client, refilled continuously. Time is a parameter, so unit tests do not need to sleep.
 *
 * <p>A token bucket rather than a fixed window: a fixed window lets a client spend double the quota across the window boundary.
 * The number of tracked keys is capped so that forged sources cannot exhaust memory; when the cap is reached and no space can be freed, requests are rejected (fail closed).
 */
public final class RateLimiter {

    private static final long IDLE_EVICT_MILLIS = 10 * 60 * 1000L;
    private static final int MAX_TRACKED = 10_000;

    private final int capacity;
    private final double refillPerMilli;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    private static final class Bucket {
        private double tokens;
        private long lastSeen;

        Bucket(double tokens, long now) {
            this.tokens = tokens;
            this.lastSeen = now;
        }
    }

    /** @param perMinute requests per client per minute; 0 = no rate limiting */
    public RateLimiter(int perMinute) {
        this.capacity = Math.max(0, perMinute);
        this.refillPerMilli = capacity / 60_000.0;
    }

    public boolean isDisabled() {
        return capacity == 0;
    }

    /** Spends one token; returns false if none is left. The key must be a result of {@link ClientAddress}. */
    public boolean allow(String client, long nowMillis) {
        if (isDisabled()) return true;
        if (buckets.size() >= MAX_TRACKED && !buckets.containsKey(client)) {
            evictIdle(nowMillis);
            if (buckets.size() >= MAX_TRACKED) return false;
        }
        Bucket bucket = buckets.computeIfAbsent(client, k -> new Bucket(capacity, nowMillis));
        synchronized (bucket) {
            long elapsed = Math.max(0, nowMillis - bucket.lastSeen);
            bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMilli);
            bucket.lastSeen = nowMillis;
            if (bucket.tokens < 1.0) return false;
            bucket.tokens -= 1.0;
            return true;
        }
    }

    /** Drops idle buckets. Can be called incidentally from a periodic main-thread task. */
    public void evictIdle(long nowMillis) {
        buckets.entrySet().removeIf(e -> {
            Bucket b = e.getValue();
            synchronized (b) {
                return nowMillis - b.lastSeen > IDLE_EVICT_MILLIS;
            }
        });
    }

    public int tracked() {
        return buckets.size();
    }
}
```

### `ClientAddress.java`

```java
package com.example.web;

import com.sun.net.httpserver.HttpExchange;

import java.net.InetSocketAddress;
import java.util.Set;

/**
 * Determines the client key used for rate limiting.
 *
 * <p>By default it is the socket's remote address. {@code X-Forwarded-For} is honored only when the socket address itself
 * is in {@code trustedProxies} (a reverse proxy), and the first address, scanning from right to left, that is not a trusted proxy is used.
 * Headers sent by untrusted sources are always ignored; otherwise a single header could impersonate thousands of sources.
 */
public final class ClientAddress {

    private static final int MAX_HEADER_LENGTH = 512;
    private final Set<String> trustedProxies;

    public ClientAddress(Set<String> trustedProxies) {
        this.trustedProxies = Set.copyOf(trustedProxies);
    }

    public String resolve(HttpExchange exchange) {
        InetSocketAddress remote = exchange.getRemoteAddress();
        if (remote == null || remote.getAddress() == null) return "unknown";
        String socketIp = remote.getAddress().getHostAddress();
        if (!trustedProxies.contains(socketIp)) return socketIp;

        String header = exchange.getRequestHeaders().getFirst("X-Forwarded-For");
        if (header == null || header.isBlank() || header.length() > MAX_HEADER_LENGTH) return socketIp;

        String[] hops = header.split(",");
        for (int i = hops.length - 1; i >= 0; i--) {
            String hop = hops[i].trim();
            if (hop.isEmpty()) continue;
            if (!trustedProxies.contains(hop)) return hop;
        }
        return socketIp;
    }
}
```

### `Responses.java`

```java
package com.example.web;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Shared response-writing logic: fixed headers, HEAD sends headers only, optional CORS. HTTP thread, zero Bukkit. */
public final class Responses {

    public static final String JSON = "application/json; charset=utf-8";
    public static final String HTML = "text/html; charset=utf-8";

    private final String corsOrigin;
    private final int cacheSeconds;

    /** @param corsOrigin empty string = send no CORS; otherwise "*" or a single origin */
    public Responses(String corsOrigin, int cacheSeconds) {
        this.corsOrigin = corsOrigin;
        this.cacheSeconds = cacheSeconds;
    }

    public String publicCache() {
        return "public, max-age=" + cacheSeconds;
    }

    /** Sends the body (HEAD sends headers only). etag may be null. The caller is responsible for closing the exchange. */
    public void send(HttpExchange x, int status, String contentType, byte[] body, String cacheControl,
                     String etag) throws IOException {
        x.getRequestBody().close();
        Headers h = x.getResponseHeaders();
        h.set("Content-Type", contentType);
        h.set("Cache-Control", cacheControl);
        h.set("X-Content-Type-Options", "nosniff");
        if (etag != null) h.set("ETag", etag);
        applyCors(h);
        if ("HEAD".equalsIgnoreCase(x.getRequestMethod()) || body.length == 0) {
            x.sendResponseHeaders(status, -1);
            return;
        }
        x.sendResponseHeaders(status, body.length);
        try (OutputStream out = x.getResponseBody()) {
            out.write(body);
        }
    }

    /** 304: no body. */
    public void notModified(HttpExchange x, String etag, String cacheControl) throws IOException {
        x.getRequestBody().close();
        Headers h = x.getResponseHeaders();
        h.set("ETag", etag);
        h.set("Cache-Control", cacheControl);
        applyCors(h);
        x.sendResponseHeaders(304, -1);
    }

    /** Errors are always {"error": "..."}; the message is escaped by Gson. Error responses are not cached. */
    public void error(HttpExchange x, int status, String message) throws IOException {
        JsonObject json = new JsonObject();
        json.addProperty("error", message);
        send(x, status, JSON, json.toString().getBytes(StandardCharsets.UTF_8), "no-store", null);
    }

    private void applyCors(Headers h) {
        if (corsOrigin.isEmpty()) return;
        h.set("Access-Control-Allow-Origin", corsOrigin);
        h.set("Access-Control-Allow-Methods", "GET, HEAD");
        if (!"*".equals(corsOrigin)) h.add("Vary", "Origin");
    }
}
```

### `RequestGuard.java`

```java
package com.example.web;

import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.function.LongSupplier;

/** Gate shared by all handlers: allow only GET/HEAD (405), then apply rate limiting (429). */
public final class RequestGuard {

    private final RateLimiter limiter;
    private final ClientAddress addresses;
    private final Responses responses;
    private final LongSupplier clock;

    public RequestGuard(RateLimiter limiter, ClientAddress addresses, Responses responses, LongSupplier clock) {
        this.limiter = limiter;
        this.addresses = addresses;
        this.responses = responses;
        this.clock = clock;
    }

    /** @return true = admitted; false = the response has already been sent, the caller should just return */
    public boolean admit(HttpExchange x) throws IOException {
        String method = x.getRequestMethod();
        if (!"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
            x.getResponseHeaders().set("Allow", "GET, HEAD");
            responses.error(x, 405, "method not allowed");
            return false;
        }
        if (!limiter.allow(addresses.resolve(x), clock.getAsLong())) {
            x.getResponseHeaders().set("Retry-After", "60");
            responses.error(x, 429, "too many requests");
            return false;
        }
        return true;
    }
}
```

### `JsonHandler.java`

```java
package com.example.web;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.util.logging.Level;
import java.util.logging.Logger;

/** Serves the contents of a {@link SnapshotStore}. HTTP thread: reads the snapshot only, never calls Bukkit. */
final class JsonHandler implements HttpHandler {

    private final String path;
    private final SnapshotStore store;
    private final RequestGuard guard;
    private final Responses responses;
    private final Logger log;

    JsonHandler(String path, SnapshotStore store, RequestGuard guard, Responses responses, Logger log) {
        this.path = path;
        this.store = store;
        this.guard = guard;
        this.responses = responses;
        this.log = log;
    }

    @Override
    public void handle(HttpExchange x) throws IOException {
        try (x) {
            if (!guard.admit(x)) return;
            if (!path.equals(x.getRequestURI().getPath())) {
                responses.error(x, 404, "not found");
                return;
            }
            SnapshotStore.Snapshot snapshot = store.current();
            if (snapshot == null) {
                // Just started; the first snapshot has not been built yet
                x.getResponseHeaders().set("Retry-After", "5");
                responses.error(x, 503, "not ready");
                return;
            }
            if (snapshot.etag().equals(x.getRequestHeaders().getFirst("If-None-Match"))) {
                responses.notModified(x, snapshot.etag(), responses.publicCache());
                return;
            }
            responses.send(x, 200, Responses.JSON, snapshot.body(), responses.publicCache(), snapshot.etag());
        } catch (RuntimeException e) {
            log.log(Level.WARNING, "HTTP request failed: " + x.getRequestURI(), e);
            trySendError(x);
        }
    }

    private void trySendError(HttpExchange x) {
        try {
            responses.error(x, 500, "internal error");
        } catch (IOException | RuntimeException e) {
            // Connection already closed or headers already sent: nothing else can be done
            log.log(Level.FINE, "could not send error response", e);
        }
    }
}
```

### `StaticPageHandler.java`

```java
package com.example.web;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.bukkit.plugin.Plugin;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.logging.Level;
import java.util.logging.Logger;

/** Optional: serves a static page from the jar that was read into memory at startup (serves only "/"). HTTP thread, zero Bukkit. */
final class StaticPageHandler implements HttpHandler {

    private static final byte[] BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    private final byte[] page;
    private final RequestGuard guard;
    private final Responses responses;
    private final Logger log;

    StaticPageHandler(byte[] page, RequestGuard guard, Responses responses, Logger log) {
        this.page = page.clone();
        this.guard = guard;
        this.responses = responses;
        this.log = log;
    }

    /** Main thread (onEnable): reads the resource inside the jar and strips the UTF-8 BOM; returns null if not found. */
    static byte[] load(Plugin plugin, String resource) {
        try (InputStream in = plugin.getResource(resource)) {
            if (in == null) return null;
            byte[] bytes = in.readAllBytes();
            boolean hasBom = bytes.length >= 3 && bytes[0] == BOM[0] && bytes[1] == BOM[1] && bytes[2] == BOM[2];
            return hasBom ? Arrays.copyOfRange(bytes, 3, bytes.length) : bytes;
        } catch (IOException e) {
            plugin.getLogger().log(Level.WARNING, "Could not read bundled resource " + resource, e);
            return null;
        }
    }

    @Override
    public void handle(HttpExchange x) throws IOException {
        try (x) {
            if (!guard.admit(x)) return;
            String path = x.getRequestURI().getPath();
            if (!"/".equals(path) && !"/index.html".equals(path)) {
                responses.error(x, 404, "not found");
                return;
            }
            responses.send(x, 200, Responses.HTML, page, responses.publicCache(), null);
        } catch (RuntimeException e) {
            log.log(Level.WARNING, "HTTP static page failed", e);
        }
    }
}
```

### `EmbeddedHttpServer.java`

```java
package com.example.web;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Lifecycle of the HttpServer. {@link #start()}/{@link #stop()} are called only on the main thread (onEnable/onDisable).
 * Failing to bind the address or port only means "the web feature is disabled"; it does not make the plugin fail.
 */
public final class EmbeddedHttpServer {

    private static final int BACKLOG = 0;                // 0 = system default
    private static final String THREAD_PREFIX = "web-http-";

    private final WebConfig config;
    private final Map<String, SnapshotStore> routes;
    private final byte[] page;                           // May be null: no static page is served
    private final Logger log;
    private final RateLimiter limiter;
    private HttpServer server;
    private ExecutorService executor;

    /** @param routes path -> snapshot for that path (e.g. "/api/players"); copied defensively */
    public EmbeddedHttpServer(WebConfig config, Map<String, SnapshotStore> routes, byte[] page, Logger log) {
        this.config = config;
        this.routes = new LinkedHashMap<>(routes);
        this.page = page == null ? null : page.clone();
        this.log = log;
        this.limiter = new RateLimiter(config.ratePerMinute());
    }

    public RateLimiter limiter() {
        return limiter;
    }

    /** @return true = listening */
    public boolean start() {
        if (!config.enabled()) return false;
        if (server != null) return true;

        HttpServer created;
        try {
            InetAddress address = InetAddress.getByName(config.bind());
            created = HttpServer.create(new InetSocketAddress(address, config.port()), BACKLOG);
            if (!address.isLoopbackAddress()) {
                log.warning("Web is bound to non-loopback " + config.bind()
                    + ". Put a reverse proxy with TLS in front of it.");
            }
        } catch (IOException | IllegalArgumentException | SecurityException e) {
            // Port in use or invalid address: log it and disable the feature; the rest of the plugin keeps working
            log.log(Level.WARNING, "Web server could not bind " + config.bind() + ":" + config.port()
                + "; the web feature is disabled.", e);
            return false;
        }

        AtomicInteger counter = new AtomicInteger();
        executor = Executors.newFixedThreadPool(config.threads(), r -> {
            Thread t = new Thread(r, THREAD_PREFIX + counter.incrementAndGet());
            t.setDaemon(true);
            return t;
        });
        created.setExecutor(executor);   // Dedicated and bounded; never use the common pool

        Responses responses = new Responses(config.corsOrigin(), config.cacheSeconds());
        RequestGuard guard = new RequestGuard(
            limiter, new ClientAddress(config.trustedProxies()), responses, System::currentTimeMillis);

        if (page != null) {
            created.createContext("/", new StaticPageHandler(page, guard, responses, log));
        }
        routes.forEach((path, store) ->
            created.createContext(path, new JsonHandler(path, store, guard, responses, log)));
        created.start();
        server = created;
        log.info("Web listening on " + created.getAddress().getAddress().getHostAddress()
            + ":" + created.getAddress().getPort());
        return true;
    }

    /** Main thread; safe if never started and safe to call repeatedly. */
    public void stop() {
        HttpServer s = server;
        ExecutorService pool = executor;
        server = null;
        executor = null;
        if (s != null) s.stop(0);
        if (pool != null) pool.shutdownNow();
    }

    /** The port actually bound; -1 when not listening (useful for tests that set port 0). */
    public int boundPort() {
        return server == null ? -1 : server.getAddress().getPort();
    }
}
```

### `PlayersSnapshotTask.java`

```java
package com.example.web;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

/**
 * Periodic main-thread task: read Bukkit state -> build JSON -> publish.
 * This is the only place that touches Bukkit; HTTP threads only read the {@link SnapshotStore}.
 */
public final class PlayersSnapshotTask implements Runnable {

    private final SnapshotStore store;

    public PlayersSnapshotTask(SnapshotStore store) {
        this.store = store;
    }

    @Override
    public void run() {
        JsonArray players = new JsonArray();
        for (Player player : Bukkit.getOnlinePlayers()) {
            JsonObject entry = new JsonObject();
            entry.addProperty("name", player.getName());
            entry.addProperty("world", player.getWorld().getName());
            entry.addProperty("ping", player.getPing());
            players.add(entry);
        }
        JsonObject root = new JsonObject();
        root.addProperty("generatedAt", System.currentTimeMillis());
        root.addProperty("online", players.size());
        root.add("players", players);
        store.publish(root, System.currentTimeMillis());
    }
}
```

### `WebPlugin.java`

```java
package com.example.web;

import org.bukkit.plugin.java.JavaPlugin;

import java.util.Map;

public final class WebPlugin extends JavaPlugin {

    private static final String PAGE_RESOURCE = "web/index.html";   // Optional: place it in src/main/resources/web/

    private EmbeddedHttpServer web;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        WebConfig config = WebConfig.from(getConfig().getConfigurationSection("web"));

        SnapshotStore players = new SnapshotStore();
        byte[] page = StaticPageHandler.load(this, PAGE_RESOURCE);   // Returns null if not found, in which case no index page is served

        web = new EmbeddedHttpServer(config, Map.of("/api/players", players), page, getLogger());
        if (!web.start()) {
            return;   // Not enabled or bind failed: feature disabled, the rest of the plugin keeps working
        }

        // Rebuild the snapshot periodically on the main thread; the first run is on the next tick, and handlers respond 503 before that
        getServer().getScheduler().runTaskTimer(this, new PlayersSnapshotTask(players), 1L, config.refreshTicks());
        // Also periodically evict idle rate-limit buckets
        getServer().getScheduler().runTaskTimer(this,
            () -> web.limiter().evictIdle(System.currentTimeMillis()), 20L * 60, 20L * 60);
    }

    @Override
    public void onDisable() {
        getServer().getScheduler().cancelTasks(this);
        if (web != null) {
            web.stop();   // server.stop(0) + executor.shutdownNow()
        }
    }
}
```

## Recommended Directory Structure

```
src/main/
├── java/com/example/web/
│   ├── WebPlugin.java              ← Wiring (start in onEnable, stop in onDisable)
│   ├── WebConfig.java
│   ├── EmbeddedHttpServer.java     ← The only place in the project that uses HttpServer
│   ├── RequestGuard.java / RateLimiter.java / ClientAddress.java
│   ├── Responses.java / JsonHandler.java / StaticPageHandler.java
│   ├── SnapshotStore.java
│   └── PlayersSnapshotTask.java    ← The only class that touches Bukkit (main thread)
└── resources/
    ├── config.yml
    └── web/index.html              ← Optional, saved as UTF-8 without BOM
```

## Thread Safety

- **HTTP threads must not call any Bukkit API** (including `Bukkit.getOnlinePlayers()`, `Player#getName()`, `getConfig()`). Data they need is first converted to JSON bytes in the main-thread `PlayersSnapshotTask` and then published.
- Snapshots are **replaced as a whole**: `AtomicReference.set` publishes an immutable object, so handlers always see a complete one and no lock is needed. Never modify a published collection or array in place.
- Config is parsed into an immutable record at startup; changes to `bind`/`port`/`enabled` require a restart, and reload does not rebind.
- In `onDisable`, call `cancelTasks(this)` first, then `web.stop()`; `server.stop(0)` closes immediately, `shutdownNow()` interrupts the threads, and daemon threads will not hold up JVM exit.
- If the snapshot task throws, nothing is published that round and the old snapshot keeps being served; catching and logging inside the task is better than letting the scheduler print a stack trace.
- See [`references/paper-threading.md`](references/paper-threading.md).

## Security

- Defaults to `127.0.0.1`; public access goes through a reverse proxy (TLS, external rate limiting, access logs), and `X-Forwarded-For` is honored only after the proxy's address is added to `trusted-proxies`.
- Return only **publicly shareable** data; never include UUIDs paired with IPs, coordinates, permissions, or any write operation. Read-only, no sessions, no cookies.
- Only GET/HEAD are allowed; other methods get 405 with an `Allow` header.
- CORS is off by default. Set `cors-origin` only when browsers need cross-origin reads, and prefer a single origin over `*`.
- If authentication is also needed, do the token comparison after rate limiting and use `MessageDigest.isEqual` (constant-time comparison).
- Always save static pages as **UTF-8 without BOM** (`StaticPageHandler.load` strips a BOM again as a safeguard), and send responses with `charset=utf-8` and `X-Content-Type-Options: nosniff`.

## Fallback

| Error | Cause | Solution |
|------|------|------|
| `java.net.BindException: Address already in use` | Port already in use (another plugin/process) | `EmbeddedHttpServer.start()` already catches it: logs a warning, returns false, and disables the feature; change `web.port` and restart |
| Always returns 503 | The snapshot task is not scheduled, or throws on every build | Confirm `runTaskTimer` is scheduled; check console exceptions; catch and log inside the task |
| Server lag, `ConcurrentModificationException`, odd Bukkit async exceptions | A handler touched Bukkit or a shared mutable collection | Read Bukkit only in `PlayersSnapshotTask`; convert to JSON before publishing |
| Everyone is rate limited (429) | Behind a reverse proxy, all requests come from `127.0.0.1` | Add the proxy IP to `trusted-proxies` and have the proxy set `X-Forwarded-For` |
| Rate limiting is easily bypassed | `X-Forwarded-For` from arbitrary sources is trusted | Honor the header only for socket addresses in `trusted-proxies` (`ClientAddress`) |
| Garbled text in the browser | Page saved as UTF-16 / with BOM, or `charset` missing | Save as UTF-8 without BOM; include `charset=utf-8` in the response `Content-Type` |
| Browser CORS error | Frontend domain differs from the API origin | Set `cors-origin` to the frontend origin, or have the reverse proxy serve the page and API on the same domain |
| Threads linger / port still occupied after shutdown | `onDisable` did not call `stop()` | `server.stop(0)` + `executor.shutdownNow()`; use daemon threads |
| No rebind after `/reload` | By design: bind/port changes require a restart | Restart the server |
