---
id: paper-embedded-http
title: Paper Embedded HTTP
titleZh: 內嵌唯讀 HTTP 服務
description: Serve a small read-only JSON API and optional static page from a Paper plugin with the JDK HttpServer - loopback bind, bounded daemon pool, main-thread immutable snapshots, per-IP token-bucket rate limiting.
descriptionZh: 在 Paper 插件內以 JDK HttpServer 提供唯讀 JSON／靜態頁面：預設只綁 127.0.0.1、有界 daemon 執行緒池、handler 零 Bukkit 呼叫（主執行緒定時發布不可變快照）、每 IP token bucket 限流。
version: "1.0.0"
status: active
category: paper-integration
categoryLabel: Paper 整合
categoryLabelEn: Paper Integration
tags: [paper-api, http, httpserver, json, rate-limit, snapshot]
triggerKeywords:
  - "embedded HTTP server"
  - "內嵌 HTTP"
  - "HttpServer"
  - "web API"
  - "JSON API"
  - "rate limit"
  - "反向代理"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-embedded-http/SKILL.md
featured: false
---

# Paper Embedded HTTP

## 目的

讓插件以零依賴方式對外提供小型唯讀網頁／JSON API。HTTP 執行緒絕不呼叫 Bukkit；主執行緒定時把資料轉成 JSON 位元組，整份替換進 `AtomicReference`，handler 只讀快照。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證）
- 純 Paper API（JDK `jdk.httpserver` + paper-api 附帶的 Gson），不需要 Paperweight
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### EmbeddedHttpServer.java（生命週期）

```java
HttpServer created = HttpServer.create(new InetSocketAddress(InetAddress.getByName(config.bind()), config.port()), 0);
executor = Executors.newFixedThreadPool(config.threads(), r -> {
    Thread t = new Thread(r, "web-http-" + counter.incrementAndGet());
    t.setDaemon(true);
    return t;
});
created.setExecutor(executor);   // 專屬、有界；絕不用 common pool
// onDisable
server.stop(0);
executor.shutdownNow();
```

### SnapshotStore.java（發布快照）

```java
public void publish(JsonElement json, long nowMillis) {
    byte[] body = GSON.toJson(json).getBytes(StandardCharsets.UTF_8);
    ref.set(new Snapshot(body, etag(body), nowMillis));   // 整份替換
}
```

### JsonHandler.java（503 直到有快照）

```java
SnapshotStore.Snapshot snapshot = store.current();
if (snapshot == null) {
    responses.error(x, 503, "not ready");
    return;
}
responses.send(x, 200, Responses.JSON, snapshot.body(), responses.publicCache(), snapshot.etag());
```

---

## 規則

- handler 內不呼叫任何 Bukkit API；資料一律由主執行緒任務轉成不可變快照
- 預設 `bind: 127.0.0.1`，公開存取放反向代理（TLS、對外限流）
- 只允許 GET／HEAD（其他 405）；CORS 預設關閉
- 限流 key 是 socket 位址；只有 `trusted-proxies` 內的來源才採用 `X-Forwarded-For`
- 埠被占用只停用網頁功能，不影響插件其餘部分
- JSON 用 Gson 序列化（不手動拼字串）；靜態頁 UTF-8 無 BOM

---

## 執行緒安全

- HTTP 執行緒只讀 `AtomicReference` 內的不可變快照
- `onDisable`：`cancelTasks` → `server.stop(0)` → `executor.shutdownNow()`
- 設定啟動時解析成不可變 record；bind／port 變更需重啟
