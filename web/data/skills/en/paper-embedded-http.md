# Paper Embedded HTTP

## Purpose

Let a plugin expose a small read-only web page / JSON API with zero dependencies. HTTP threads never call Bukkit; the main thread periodically converts data into JSON bytes and swaps the whole thing into an `AtomicReference`, and handlers only read the snapshot.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both compile-verified)
- Pure Paper API (JDK `jdk.httpserver` + the Gson bundled with paper-api), no Paperweight needed
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### EmbeddedHttpServer.java (lifecycle)

```java
HttpServer created = HttpServer.create(new InetSocketAddress(InetAddress.getByName(config.bind()), config.port()), 0);
executor = Executors.newFixedThreadPool(config.threads(), r -> {
    Thread t = new Thread(r, "web-http-" + counter.incrementAndGet());
    t.setDaemon(true);
    return t;
});
created.setExecutor(executor);   // dedicated and bounded; never the common pool
// onDisable
server.stop(0);
executor.shutdownNow();
```

### SnapshotStore.java (publish a snapshot)

```java
public void publish(JsonElement json, long nowMillis) {
    byte[] body = GSON.toJson(json).getBytes(StandardCharsets.UTF_8);
    ref.set(new Snapshot(body, etag(body), nowMillis));   // swap the whole snapshot
}
```

### JsonHandler.java (503 until a snapshot exists)

```java
SnapshotStore.Snapshot snapshot = store.current();
if (snapshot == null) {
    responses.error(x, 503, "not ready");
    return;
}
responses.send(x, 200, Responses.JSON, snapshot.body(), responses.publicCache(), snapshot.etag());
```

---

## Rules

- Handlers never call any Bukkit API; data is always converted into an immutable snapshot by a main-thread task
- Default `bind: 127.0.0.1`; put public access behind a reverse proxy (TLS, outward rate limiting)
- Only GET / HEAD are allowed (405 otherwise); CORS is off by default
- The rate-limit key is the socket address; `X-Forwarded-For` is honored only from sources in `trusted-proxies`
- If the port is taken, only the web feature is disabled; the rest of the plugin is unaffected
- Serialize JSON with Gson (never build strings by hand); static pages are UTF-8 without BOM

---

## Thread Safety

- HTTP threads only read the immutable snapshot inside the `AtomicReference`
- `onDisable`: `cancelTasks` -> `server.stop(0)` -> `executor.shutdownNow()`
- Config is parsed at startup into an immutable record; changing bind / port requires a restart
