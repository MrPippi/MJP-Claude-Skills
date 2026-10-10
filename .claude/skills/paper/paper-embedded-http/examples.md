# examples — paper-embedded-http

## Example 1: Leaderboard JSON API + static page

**Input:**
```
base_package: com.example.web
bind: 127.0.0.1
port: 8080
routes: /api/leaderboard
refresh_ticks: 200
static_resource: web/index.html
```

**Output - the main thread converts the leaderboard to JSON and publishes it (HTTP threads never see Bukkit):**
```java
package com.example.leaderboard;

import com.example.web.SnapshotStore;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.Comparator;
import java.util.List;
import java.util.function.Supplier;

/** Main-thread task: fetch leaderboard data (the caller guarantees the main thread) -> sort and take the top N -> publish. */
public final class LeaderboardSnapshotTask implements Runnable {

    /** Read-only row for publishing; name may contain any characters, and Gson escapes them. */
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

**Wiring - two routes (leaderboard + online players) plus a static page, inside `onEnable`:**
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

**`src/main/resources/web/index.html` - display names via `textContent` to avoid XSS (save as UTF-8 without BOM):**
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

## Example 2: nginx / Caddy reverse proxy (public access)

**Input:**
```
public_host: stats.example.com
upstream: 127.0.0.1:8080
```

**Output - nginx (TLS and external rate limiting live in the proxy; the plugin's `trusted-proxies` must contain `127.0.0.1`):**
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
        # Overwrite rather than append: do not trust the client's own X-Forwarded-For
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 10s;
    }
}
```

**Output - Caddy (automatic TLS):**
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

**Output - plugin `config.yml`:**
```yaml
web:
  enabled: true
  bind: 127.0.0.1
  port: 8080
  trusted-proxies: ["127.0.0.1"]
```

---

## Example 3: Verify rate limiting and client address resolution without sleeping

**Input:**
```
test: token bucket refill and X-Forwarded-For rules
```

**Output - time is a parameter, so feed milliseconds directly:**
```java
package com.example.web;

public final class RateLimiterCheck {

    public static void main(String[] args) {
        RateLimiter limiter = new RateLimiter(60);          // 60 per minute = 1 per second

        long t = 0;
        int allowed = 0;
        for (int i = 0; i < 100; i++) {
            if (limiter.allow("203.0.113.9", t)) allowed++;
        }
        System.out.println("burst allowed = " + allowed);    // 60 (bucket capacity)

        System.out.println(limiter.allow("203.0.113.9", t + 1_000));   // true: 1 token refilled after 1 second
        System.out.println(limiter.allow("203.0.113.9", t + 1_000));   // false: empty again
        System.out.println(limiter.allow("198.51.100.7", t));          // true: another IP has its own bucket
    }
}
```
