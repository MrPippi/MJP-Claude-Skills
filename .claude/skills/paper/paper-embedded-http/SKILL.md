---
name: paper-embedded-http
description: "在 Paper 插件內以 JDK HttpServer 提供唯讀 JSON／靜態頁面：預設只綁 127.0.0.1、有界 daemon 執行緒池、handler 零 Bukkit 呼叫（主執行緒定時發布不可變快照）、每 IP token bucket 限流 / Read-only JSON and static page endpoint inside a Paper plugin using the JDK HttpServer with loopback bind, bounded daemon pool, main-thread snapshots and per-IP rate limiting"
---

# Paper Embedded HTTP / 內嵌唯讀 HTTP 服務

## 技能名稱 / Skill Name

`paper-embedded-http`

## 目的 / Purpose

讓插件對外提供一個小型**唯讀**網頁或 JSON API（排行榜、市場價格、線上人數），不加任何依賴：使用 JDK 內建的 `com.sun.net.httpserver.HttpServer` 與 paper-api 附帶的 Gson。

核心設計：

- **handler 永遠不呼叫 Bukkit API。** Bukkit 不是執行緒安全的；HTTP 執行緒只讀「主執行緒定時建好、整份替換」的不可變快照（`AtomicReference`）。
- 第一份快照出現前一律回 **503**。
- 預設只綁 `127.0.0.1`；要公開請在前面放反向代理（nginx／Caddy，見 `examples.md`），由代理負責 TLS 與對外限流。
- 專屬、有界的 daemon 執行緒池，絕不使用 `ForkJoinPool.commonPool()`。
- 每個 IP 的 token bucket 限流；只有請求來自設定的**受信任代理**時才採用 `X-Forwarded-For`。
- 埠被占用時記錄警告並**只停用這個功能**，插件其餘照常。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（只用 JDK `jdk.httpserver` 模組、Gson 與 Bukkit scheduler，兩版相同）
- 純 Paper API，不需要 Paperweight
- `com.sun.net.httpserver` 屬於 `jdk.httpserver` 模組，Paper 伺服器的 JRE 內含；Gradle 編譯無需額外設定

## 觸發條件 / Triggers

- 「內嵌 HTTP」「embedded HTTP server」「HttpServer」「web API」「JSON API」
- 「排行榜網頁」「網頁面板」「status page」「REST endpoint」
- 「限流」「rate limit」「token bucket」「X-Forwarded-For」「反向代理」「CORS」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `base_package` | `com.example.web` | 放置 HTTP 類別的 package |
| `bind` | `127.0.0.1` | 綁定位址；公開存取請維持 loopback 並加反向代理 |
| `port` | `8080` | 監聽埠 |
| `routes` | `/api/players` | 要開放的唯讀路徑（每條路徑對應一個 `SnapshotStore`） |
| `refresh_ticks` | `100` | 主執行緒重建快照的間隔 |
| `static_resource` | `web/index.html` | 選用：打包在 jar 內的靜態頁面 |

## 輸出產物 / Outputs

- `WebConfig.java` — 不可變設定 record（啟動時解析一次）
- `SnapshotStore.java` — 以 `AtomicReference` 發布 JSON 快照
- `RateLimiter.java` — 每 IP token bucket（時間為參數，可無 sleep 測試）
- `ClientAddress.java` — 取得客戶端 IP（受信任代理才看 `X-Forwarded-For`）
- `Responses.java` — 固定標頭、CORS（選用）、HEAD 處理、錯誤 JSON
- `RequestGuard.java` — 方法守門（405）與限流（429）
- `JsonHandler.java` — 回傳快照（503／304／200）
- `StaticPageHandler.java` — 選用：回傳 jar 內的靜態頁面（去 BOM）
- `EmbeddedHttpServer.java` — 生命週期：綁定、執行緒池、停止
- `PlayersSnapshotTask.java` — 主執行緒建快照的範例任務
- `WebPlugin.java` — 接線：`onEnable` 啟動、`onDisable` 乾淨關閉
- `config.yml` 片段

## 建置設定 / Build Setup

見 [`Skills/paper-api/PLATFORM.md`](../../paper-api/PLATFORM.md)。不需要新增任何依賴；Gson 由 `paper-api` 傳遞提供（伺服器端也已內建，不要 shade）。

`config.yml`：

```yaml
web:
  enabled: false              # 預設關閉；確認 bind／port 後再開
  bind: 127.0.0.1             # 公開存取請放反向代理，不要直接改成 0.0.0.0
  port: 8080
  threads: 2                  # handler 執行緒數（固定上限）
  rate-limit-per-minute: 120  # 每個 IP；0 = 不限流
  trusted-proxies: []         # 例：["127.0.0.1"]，只有來自這些位址的請求才採用 X-Forwarded-For
  cors-origin: ""             # 空字串 = 不送 CORS 標頭；"*" 或單一來源 = 啟用
  cache-seconds: 5            # Cache-Control: public, max-age
  refresh-ticks: 100          # 主執行緒重建快照的間隔（20 ticks = 1 秒）
```

## 代碼範本 / Code Template

### `WebConfig.java`

```java
package com.example.web;

import org.bukkit.configuration.ConfigurationSection;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** 不可變的網頁設定。啟動時解析一次；bind／port／enabled 變更需要重啟，不支援 reload 重新綁定。 */
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

    /** 缺少的鍵一律退回安全預設（停用、loopback）。 */
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
 * 主執行緒建好 JSON、轉成 UTF-8 位元組後整份替換；HTTP 執行緒只讀 {@link #current()}。
 * 每個路由一個實例（不是靜態單例）。快照內的位元組陣列發布後不得修改。
 */
public final class SnapshotStore {

    /** 已序列化的 JSON（UTF-8，無 BOM）、ETag 與建立時間。 */
    public record Snapshot(byte[] body, String etag, long builtAtMillis) {
    }

    // Gson 實例是執行緒安全且不可變的；預設會跳脫 < > & '，嵌進 HTML 也安全。
    private static final Gson GSON = new Gson();

    // 第一份快照出現前為 null（handler 回 503）。
    private final AtomicReference<Snapshot> ref = new AtomicReference<>();

    /** 主執行緒呼叫：序列化並發布。Gson 負責字串跳脫，不要自己拼 JSON。 */
    public void publish(JsonElement json, long nowMillis) {
        byte[] body = GSON.toJson(json).getBytes(StandardCharsets.UTF_8);
        CRC32 crc = new CRC32();
        crc.update(body);
        String etag = "\"" + Long.toHexString(crc.getValue()) + "-" + Integer.toHexString(body.length) + "\"";
        ref.set(new Snapshot(body, etag, nowMillis));
    }

    /** 任何執行緒；尚未發布過回傳 null。 */
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
 * 每個客戶端一個 token bucket，持續補充。時間是參數，單元測試不必 sleep。
 *
 * <p>token bucket 而不是固定視窗：固定視窗讓客戶端能在視窗邊界連花兩倍額度。
 * 追蹤的 key 數有上限，避免偽造大量來源把記憶體撐爆；超過上限且清不出空間時拒絕（fail closed）。
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

    /** @param perMinute 每個客戶端每分鐘的請求數；0 = 不限流 */
    public RateLimiter(int perMinute) {
        this.capacity = Math.max(0, perMinute);
        this.refillPerMilli = capacity / 60_000.0;
    }

    public boolean isDisabled() {
        return capacity == 0;
    }

    /** 花掉一個 token；沒有就回 false。key 必須是 {@link ClientAddress} 的結果。 */
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

    /** 丟掉閒置的 bucket。可由主執行緒的定時任務順便呼叫。 */
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
 * 決定限流用的客戶端 key。
 *
 * <p>預設是 socket 的遠端位址。只有 socket 位址本身在 {@code trustedProxies} 內（反向代理）時，才採用
 * {@code X-Forwarded-For}，且從右往左取第一個「不是受信任代理」的位址。
 * 不受信任的來源送的 header 一律忽略，否則一行 header 就能偽裝成上千個來源。
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

/** 寫回應的共用邏輯：固定標頭、HEAD 只送標頭、CORS 選用。HTTP 執行緒，零 Bukkit。 */
public final class Responses {

    public static final String JSON = "application/json; charset=utf-8";
    public static final String HTML = "text/html; charset=utf-8";

    private final String corsOrigin;
    private final int cacheSeconds;

    /** @param corsOrigin 空字串 = 不送 CORS；否則是 "*" 或單一來源 */
    public Responses(String corsOrigin, int cacheSeconds) {
        this.corsOrigin = corsOrigin;
        this.cacheSeconds = cacheSeconds;
    }

    public String publicCache() {
        return "public, max-age=" + cacheSeconds;
    }

    /** 送出 body（HEAD 只送標頭）。etag 可為 null。caller 負責 close exchange。 */
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

    /** 304：沒有 body。 */
    public void notModified(HttpExchange x, String etag, String cacheControl) throws IOException {
        x.getRequestBody().close();
        Headers h = x.getResponseHeaders();
        h.set("ETag", etag);
        h.set("Cache-Control", cacheControl);
        applyCors(h);
        x.sendResponseHeaders(304, -1);
    }

    /** 錯誤一律是 {"error": "..."}；訊息由 Gson 跳脫。錯誤回應不快取。 */
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

/** 所有 handler 共用的守門：只允許 GET／HEAD（405），再套用限流（429）。 */
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

    /** @return true = 放行；false = 已經回應完畢，呼叫端直接 return */
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

/** 回傳某個 {@link SnapshotStore} 的內容。HTTP 執行緒：只讀快照，絕不呼叫 Bukkit。 */
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
                // 剛啟動、第一份快照還沒建好
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
            // 連線已斷或標頭已送出：沒有別的能做
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

/** 選用：回傳啟動時讀進記憶體的 jar 內靜態頁面（只服務 "/"）。HTTP 執行緒，零 Bukkit。 */
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

    /** 主執行緒（onEnable）：讀 jar 內資源並去掉 UTF-8 BOM；找不到回傳 null。 */
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
 * HttpServer 的生命週期。{@link #start()}／{@link #stop()} 只在主執行緒呼叫（onEnable／onDisable）。
 * 綁不到位址或埠只代表「網頁功能停用」，不會讓插件失敗。
 */
public final class EmbeddedHttpServer {

    private static final int BACKLOG = 0;                // 0 = 系統預設
    private static final String THREAD_PREFIX = "web-http-";

    private final WebConfig config;
    private final Map<String, SnapshotStore> routes;
    private final byte[] page;                           // 可為 null：不提供靜態頁面
    private final Logger log;
    private final RateLimiter limiter;
    private HttpServer server;
    private ExecutorService executor;

    /** @param routes 路徑 → 該路徑的快照（例如 "/api/players"）；會被複製 */
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

    /** @return true = 正在監聽 */
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
            // 埠被占用、位址無效：記錄後停用功能，插件其餘照常
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
        created.setExecutor(executor);   // 專屬、有界；絕不用 common pool

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

    /** 主執行緒；沒啟動過、重複呼叫都安全。 */
    public void stop() {
        HttpServer s = server;
        ExecutorService pool = executor;
        server = null;
        executor = null;
        if (s != null) s.stop(0);
        if (pool != null) pool.shutdownNow();
    }

    /** 實際綁上的埠；沒在監聽回 -1（設定 port 0 的測試可用）。 */
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
 * 主執行緒定時任務：讀 Bukkit 狀態 → 建 JSON → 發布。
 * 這是唯一碰 Bukkit 的地方；HTTP 執行緒只讀 {@link SnapshotStore}。
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

    private static final String PAGE_RESOURCE = "web/index.html";   // 選用：放在 src/main/resources/web/

    private EmbeddedHttpServer web;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        WebConfig config = WebConfig.from(getConfig().getConfigurationSection("web"));

        SnapshotStore players = new SnapshotStore();
        byte[] page = StaticPageHandler.load(this, PAGE_RESOURCE);   // 找不到就回 null，不提供首頁

        web = new EmbeddedHttpServer(config, Map.of("/api/players", players), page, getLogger());
        if (!web.start()) {
            return;   // 未啟用或綁定失敗：功能停用，插件其餘照常
        }

        // 主執行緒定時重建快照；第一次在下一個 tick 執行，之前 handler 回 503
        getServer().getScheduler().runTaskTimer(this, new PlayersSnapshotTask(players), 1L, config.refreshTicks());
        // 順便定期清掉閒置的限流 bucket
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

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/
├── java/com/example/web/
│   ├── WebPlugin.java              ← 接線（onEnable 啟動、onDisable 關閉）
│   ├── WebConfig.java
│   ├── EmbeddedHttpServer.java     ← 全專案唯一出現 HttpServer 的地方
│   ├── RequestGuard.java / RateLimiter.java / ClientAddress.java
│   ├── Responses.java / JsonHandler.java / StaticPageHandler.java
│   ├── SnapshotStore.java
│   └── PlayersSnapshotTask.java    ← 唯一碰 Bukkit 的類別（主執行緒）
└── resources/
    ├── config.yml
    └── web/index.html              ← 選用，存成 UTF-8 無 BOM
```

## 執行緒安全注意事項 / Thread Safety

- **HTTP 執行緒禁止呼叫任何 Bukkit API**（含 `Bukkit.getOnlinePlayers()`、`Player#getName()`、`getConfig()`）。需要的資料在主執行緒的 `PlayersSnapshotTask` 先轉成 JSON 位元組再發布。
- 快照是**整份替換**：`AtomicReference.set` 發布不可變物件，handler 永遠看到完整的一份，不需要鎖。不要原地修改已發布的集合或陣列。
- 設定在啟動時解析成不可變 record；`bind`／`port`／`enabled` 變更需重啟，reload 不重新綁定。
- `onDisable` 先 `cancelTasks(this)` 再 `web.stop()`；`server.stop(0)` 立即關閉、`shutdownNow()` 中斷執行緒，daemon 執行緒不會拖住 JVM 結束。
- 快照任務若丟例外，該次不發布、舊快照繼續服務；在任務內接住並記錄比讓 scheduler 印堆疊更好。
- 詳見 [`Skills/_shared/paper-threading.md`](../../_shared/paper-threading.md)。

## 安全性 / Security

- 預設 `127.0.0.1`；公開存取走反向代理（TLS、對外限流、存取日誌），代理的位址放進 `trusted-proxies` 才會採用 `X-Forwarded-For`。
- 只回傳**可公開**的資料；不要把 UUID 與 IP、座標、權限或任何寫入操作放進去。唯讀、無 session、無 cookie。
- 只允許 GET／HEAD；其他方法回 405 並帶 `Allow` 標頭。
- CORS 預設關閉。需要瀏覽器跨來源讀取時才設 `cors-origin`，優先使用單一來源而非 `*`。
- 若還需要驗證，token 比較放在限流之後，並使用 `MessageDigest.isEqual`（定時比較）。
- 靜態頁面一律存成 **UTF-8 無 BOM**（`StaticPageHandler.load` 會再去一次 BOM 作為保險），回應帶 `charset=utf-8` 與 `X-Content-Type-Options: nosniff`。

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `java.net.BindException: Address already in use` | 埠被占用（另一個插件／程序） | `EmbeddedHttpServer.start()` 已接住：記錄警告、回 false、功能停用；改 `web.port` 後重啟 |
| 一直回 503 | 快照任務沒排程，或每次建置都丟例外 | 確認 `runTaskTimer` 已排程；檢查主控台例外；任務內 catch 並記錄 |
| 伺服器卡頓、`ConcurrentModificationException`、奇怪的 Bukkit 非同步例外 | handler 內碰了 Bukkit 或共享的可變集合 | 只在 `PlayersSnapshotTask` 讀 Bukkit；發布前先轉成 JSON |
| 所有人都被限流（429） | 在反向代理後面，所有請求來自 `127.0.0.1` | 把代理 IP 加進 `trusted-proxies`，並讓代理設定 `X-Forwarded-For` |
| 限流可被輕易繞過 | 信任了任意來源的 `X-Forwarded-For` | 只有 `trusted-proxies` 內的 socket 位址才採用該標頭（`ClientAddress`） |
| 瀏覽器亂碼 | 頁面存成 UTF-16／帶 BOM，或缺 `charset` | 存成 UTF-8 無 BOM；回應 `Content-Type` 帶 `charset=utf-8` |
| 瀏覽器 CORS 錯誤 | 前端網域與 API 不同源 | 設定 `cors-origin` 為前端來源；或讓反向代理把頁面與 API 放在同一網域 |
| 關服後執行緒殘留／埠仍被占用 | `onDisable` 沒呼叫 `stop()` | `server.stop(0)` + `executor.shutdownNow()`；使用 daemon 執行緒 |
| `/reload` 後沒有重新綁定 | 刻意設計：bind／port 變更需重啟 | 重啟伺服器 |
