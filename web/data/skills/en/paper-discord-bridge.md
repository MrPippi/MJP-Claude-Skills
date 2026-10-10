# Paper Discord Bridge

## Purpose

Bridge in-game chat with **one Discord channel** using only the JDK (`java.net.http.HttpClient` / `WebSocket`) and the Gson bundled with paper-api; no JDA, no DiscordSRV, nothing shaded. Two tiers, pick the smallest that works:

| Tier | Direction | What Discord needs | What runs in the plugin |
|------|-----------|--------------------|-------------------------|
| 1. Webhook only | Game -> Discord | A channel webhook URL (no bot) | `PostQueue` (one daemon thread) |
| 2. Two-way | Game <-> Discord | Tier 1 plus a bot: token, Message Content Intent enabled, channel permissions, channel ID | `PostQueue` + `GatewayClient` (one scheduled thread) |

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (identical on both; uses `AsyncChatEvent`, Adventure, the Bukkit scheduler)
- Pure Paper API, no Paperweight needed; `java.net.http` is part of the JDK and Gson ships with paper-api, so no extra dependencies
- Discord API v10, Gateway `encoding=json` (no compression)

---

## Generated Code

### Core (no Bukkit, JUnit-testable)

`Backoff` (reconnect backoff plus jitter), `Payloads` (outbound JSON and escaping), `InboundText` (MESSAGE_CREATE filtering and cleanup), `GatewaySession` (Gateway protocol state machine).

### Payloads.java (outbound: no mentions, escaped Markdown)

```java
private static JsonObject base(String content) {
    JsonObject mentions = new JsonObject();
    mentions.add("parse", new JsonArray());            // no text can ping a user / role / @everyone
    JsonObject body = new JsonObject();
    body.addProperty("content", clip(content));
    body.addProperty("flags", SUPPRESS_EMBEDS);        // links do not unfurl
    body.add("allowed_mentions", mentions);
    return body;
}
```

### InboundText.java (inbound filtering, echo guard)

```java
if (!channelId.equals(string(d, "channel_id")) || author == null || messageId == null
        || bool(author, "bot") || present(d, "webhook_id") || !acceptedType(d)) {
    return Optional.empty();   // includes our own webhook messages (echo-loop guard)
}
```

### PostQueue.java (Discord I/O: ordered single-thread poster)

Callers only `enqueue` and never wait on HTTP. The worker posts in order; on 429 it sleeps `Retry-After` (capped) and retries once; any other failure logs one throttled WARNING with the status code only.

### GatewayClient.java (WebSocket driver)

HELLO -> heartbeat with jitter -> IDENTIFY / RESUME -> READY / RESUMED; handles opcodes 1/7/9/11, `resume_gateway_url`, zombie-connection detection, close codes that must not reconnect, and exponential backoff.

### InboundRelay.java (main thread: link check -> deliver or reply)

```java
// AccountLinks decides who may speak in game; ChatSink delivers the line
// Default uses Adventure + MiniMessage Placeholder.unparsed, so Discord text cannot inject tags
```

Also: `BridgeConfig` (immutable, `toString` masks secrets), `AccountLinks`, `ChatSink`, `DiscordBridgePlugin` (wiring), `GatewaySessionTest`, `TextRulesTest`, `config.yml`, `plugin.yml`.

---

## Rules

- Always build outbound bodies through `Payloads`: every body carries `allowed_mentions.parse = []`; replies also set `replied_user: false`
- `escapeMarkdown` also escapes `<`, so `<@id>`, `<#id>`, `<t:...>` are never rendered as mentions; the banned words `clyde` / `discord` in webhook names are split with a zero-width space
- Inbound text has U+00A7 colour codes, control characters and bidi / zero-width format characters removed, line breaks collapsed to spaces, and over-long text truncated with an ellipsis
- Ignore `webhook_id`, `author.bot` and non-default / non-reply message types (echo-loop guard)
- Do not follow redirects (so the `Authorization` header cannot be carried to another host)
- If the server already runs DiscordSRV, do not open a second connection; hook it with `paper-softdepend-hook` instead
- Templates depend only on the Paper API; no `net.minecraft` / `org.bukkit.craftbukkit`

---

## Thread Safety

| Code | Thread | Rule |
|------|--------|------|
| `onChat(AsyncChatEvent)` | Async chat thread | Read the event, then `PostQueue#enqueue` (non-blocking) |
| `PostQueue` worker | Its own daemon thread | The only place that blocks on HTTP or sleeps for `Retry-After` |
| `GatewaySession`, all `GatewayClient` state | One `DiscordBridge-Gateway` thread | WebSocket callbacks only `post` to it; never touch Bukkit here |
| `InboundRelay`, `AccountLinks`, `ChatSink` | **Main thread** (`runTask`) | Bukkit API is allowed |
| `onDisable` | Main thread | Queues drop their backlog, the gateway sends close 1000; total wait is bounded |

- Never call `Bukkit.broadcast` or `getPlayer` inside the `GatewayClient` consumer; hop to the main thread first
- `runTask` throws `IllegalPluginAccessException` while the plugin is disabling, so `runOnMain` checks `isEnabled()` and catches it
- Do not replace the single gateway thread with a pool: heartbeats must carry the latest sequence number, and a late close from an old socket must not trigger a second reconnect

---

## Notes

- Secrets never logged: the bot token and webhook URLs are not written to the console, exception messages or status; `BridgeConfig#toString` shows `***`; HTTP failures log the status code or exception class only
- With `allow-unlinked: true` the in-game name is a Discord display name anyone can choose: keep a `[Discord]` marker in `format`, or use a real link lookup and show the Minecraft name
- Common errors: `4014` Message Content Intent not enabled; `4004` wrong token (fatal codes are not retried); 403 on replies means the bot lacks channel permissions; 404 on chat means the webhook was deleted
- A full queue means Discord has been unreachable for a long time: the game is unaffected, new lines are dropped and it recovers by itself
- Messages appearing twice in game usually mean two bridges on one channel (for example DiscordSRV)
