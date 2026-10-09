# examples — paper-embedded-http

## 範例 1：排行榜 JSON API + 靜態頁面

**Input:**
```
base_package: com.example.web
bind: 127.0.0.1
port: 8080
routes: /api/leaderboard
refresh_ticks: 200
static_resource: web/index.html
```

**Output — 主執行緒把排行榜轉成 JSON 發布（HTTP 執行緒看不到 Bukkit）:**
```java
package com.example.leaderboard;

import com.example.web.SnapshotStore;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.Comparator;
import java.util.List;
import java.util.function.Supplier;

/** 主執行緒任務：取排行榜資料（呼叫端保證在主執行緒）→ 排序取前 N → 發布。 */
public final class LeaderboardSnapshotTask implements Runnable {

    /** 發布用的唯讀資料列；name 可含任何字元，Gson 會跳脫。 */
    public record Row(String name, long score) {
    }

    private static final int TOP_N = 50;

    private final Supplier<List<Row>> source;
    private final SnapshotStore store;

    public LeaderboardSnapshotTask(Supplier<List<Row>> source, SnapshotStore store) {
        this.source = source;
        this.store = store;
    }

    @Override
    public void run() {
        List<Row> top = source.get().stream()
            .sorted(Comparator.comparingLong(Row::score).reversed())
            .limit(TOP_N)
            .toList();

        JsonArray rows = new JsonArray();
        int rank = 1;
        for (Row row : top) {
            JsonObject entry = new JsonObject();
            entry.addProperty("rank", rank++);
            entry.addProperty("name", row.name());
            entry.addProperty("score", row.score());
            rows.add(entry);
        }
        JsonObject root = new JsonObject();
        root.addProperty("generatedAt", System.currentTimeMillis());
        root.add("rows", rows);
        store.publish(root, System.currentTimeMillis());
    }
}
```

**接線 — 兩條路由（排行榜 + 線上玩家）加一個靜態頁，在 `onEnable` 內:**
```java
SnapshotStore board = new SnapshotStore();
SnapshotStore players = new SnapshotStore();
byte[] page = StaticPageHandler.load(this, "web/index.html");

web = new EmbeddedHttpServer(config,
    Map.of("/api/leaderboard", board, "/api/players", players), page, getLogger());
if (web.start()) {
    getServer().getScheduler().runTaskTimer(this,
        new LeaderboardSnapshotTask(() -> statsService.topScores(), board), 1L, config.refreshTicks());
    getServer().getScheduler().runTaskTimer(this, new PlayersSnapshotTask(players), 1L, config.refreshTicks());
}
```

**`src/main/resources/web/index.html` — 以 `textContent` 顯示名稱，避免 XSS（存成 UTF-8 無 BOM）:**
```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>Leaderboard</title>
</head>
<body>
  <h1>Leaderboard</h1>
  <ol id="rows"></ol>
  <script>
    fetch('/api/leaderboard')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const list = document.getElementById('rows');
        for (const row of data.rows) {
          const li = document.createElement('li');
          li.textContent = row.name + ' - ' + row.score;
          list.appendChild(li);
        }
      })
      .catch(status => {
        document.getElementById('rows').textContent = status === 503 ? 'Loading, retry soon.' : 'Error ' + status;
      });
  </script>
</body>
</html>
```

---

## 範例 2：nginx / Caddy 反向代理（公開存取）

**Input:**
```
public_host: stats.example.com
upstream: 127.0.0.1:8080
```

**Output — nginx（TLS 與對外限流在代理；插件的 `trusted-proxies` 要填 `127.0.0.1`）:**
```nginx
limit_req_zone $binary_remote_addr zone=mcweb:10m rate=10r/s;

server {
    listen 443 ssl http2;
    server_name stats.example.com;

    ssl_certificate     /etc/letsencrypt/live/stats.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stats.example.com/privkey.pem;

    location / {
        limit_req zone=mcweb burst=20 nodelay;
        limit_except GET HEAD { deny all; }

        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        # 用覆蓋而不是附加：不信任客戶端自己送來的 X-Forwarded-For
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 10s;
    }
}
```

**Output — Caddy（自動 TLS）:**
```caddy
stats.example.com {
    @readonly method GET HEAD
    handle @readonly {
        reverse_proxy 127.0.0.1:8080 {
            header_up X-Forwarded-For {remote_host}
        }
    }
    respond "Method not allowed" 405
}
```

**Output — 插件 `config.yml`:**
```yaml
web:
  enabled: true
  bind: 127.0.0.1
  port: 8080
  trusted-proxies: ["127.0.0.1"]
```

---

## 範例 3：不 sleep 驗證限流與客戶端位址解析

**Input:**
```
test: token bucket 補充與 X-Forwarded-For 規則
```

**Output — 時間是參數，直接餵毫秒:**
```java
package com.example.web;

public final class RateLimiterCheck {

    public static void main(String[] args) {
        RateLimiter limiter = new RateLimiter(60);          // 每分鐘 60 = 每秒 1 個

        long t = 0;
        int allowed = 0;
        for (int i = 0; i < 100; i++) {
            if (limiter.allow("203.0.113.9", t)) allowed++;
        }
        System.out.println("burst allowed = " + allowed);    // 60（桶子容量）

        System.out.println(limiter.allow("203.0.113.9", t + 1_000));   // true：1 秒補回 1 個
        System.out.println(limiter.allow("203.0.113.9", t + 1_000));   // false：又空了
        System.out.println(limiter.allow("198.51.100.7", t));          // true：另一個 IP 有自己的桶
    }
}
```
