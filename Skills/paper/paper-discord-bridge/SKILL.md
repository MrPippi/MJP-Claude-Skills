---
name: paper-discord-bridge
description: "只用 JDK 的 Discord 聊天橋接（不需 JDA／DiscordSRV）：遊戲 → Discord 以 webhook 佇列送出（429 照 Retry-After 重送一次、禁止 @提及、Markdown 跳脫），Discord → 遊戲以 Gateway WebSocket 狀態機（心跳、RESUME、致命關閉碼、退避）在單一執行緒接收後切回主執行緒；祕密不進 log / JDK-only Discord chat bridge (no JDA or DiscordSRV): outbound webhook queue with 429 retry, no mentions and markdown escaping; inbound Gateway WebSocket state machine (heartbeat, resume, fatal close codes, backoff) on one thread, hopping to the main thread; secrets never logged"
---

# Paper Discord Bridge

## Skill Name

`paper-discord-bridge`

## Purpose

Bridge in-game chat with **one Discord channel** using nothing but the JDK (`java.net.http.HttpClient` and `WebSocket`) and the Gson that ships with paper-api. No JDA, no DiscordSRV, nothing shaded into the jar.

Two usage tiers; pick the smallest one that does the job:

| Tier | Direction | What you need on Discord | What runs in the plugin |
|------|-----------|--------------------------|-------------------------|
| **1. Webhook only** | Game → Discord | A channel webhook URL (Channel settings → Integrations → Webhooks). No bot. | `PostQueue` (one daemon thread) |
| **2. Two-way** | Game ↔ Discord | Tier 1 **plus** a bot: token, **Message Content Intent** enabled (Developer Portal → Bot), invited to the server with the `bot` scope, and in the bridged channel the permissions **View Channel**, **Read Message History**, **Send Messages**; plus the channel id (Developer Mode → right-click channel → Copy Channel ID) | `PostQueue` + `GatewayClient` (one scheduled thread) |

Core design:

- **Outbound** (`PostQueue`): callers only `enqueue` and never wait on HTTP. A daemon thread posts in order; on **429** it sleeps `Retry-After` (capped) and retries **once**, any other failure logs one throttled WARNING with the **status code only**. Every payload carries `allowed_mentions.parse = []` (nothing in it can ping anyone) and `flags = 4` (SUPPRESS_EMBEDS); player text is markdown-escaped, including `<`, so `<@id>`, `<#id>`, `<t:…>` cannot render as mentions or timestamps.
- **Inbound** (`GatewaySession` + `GatewayClient`): the Discord Gateway protocol (HELLO → heartbeat with jitter → IDENTIFY/RESUME → READY/RESUMED, opcodes 1/7/9/11, `resume_gateway_url`, zombie detection, close codes that must not reconnect, exponential backoff with jitter) is a **pure state machine** that turns events into actions and is unit-tested without a socket. `GatewayClient` only performs those actions, all on **one** scheduled executor thread. Messages are cleaned (`InboundText`) and hop to the main thread with `runTask`.
- **Pluggable edges**: `AccountLinks` decides who may speak in game (default by config: everyone, or nobody), `ChatSink` delivers the line (default: broadcast via Adventure with MiniMessage `unparsed` placeholders, so Discord text can never inject tags).
- **Secrets never logged**: the bot token and webhook URLs are not written to the console, exceptions or status; `BridgeConfig#toString` masks them as `***`; HTTP failures log the status code or exception class name only (exception messages may contain the URL).

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (identical on both; uses `AsyncChatEvent`, Adventure, the Bukkit scheduler and JDK 21+ APIs such as `HttpClient#shutdownNow`)
- Pure Paper API, no Paperweight needed
- Discord API v10, Gateway `encoding=json` (no zlib compression)

## Triggers

- 「Discord 橋接」「Discord bridge」「Discord 聊天同步」「Discord chat sync」「聊天互通」「two-way chat」
- 「webhook」「Discord webhook」「Discord Gateway」「Discord bot」「MESSAGE_CREATE」
- 「不用 JDA」「without JDA」「不用 DiscordSRV」「死亡訊息送 Discord」「announce to Discord」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `base_package` | `com.example.discordbridge` | Root package; pure logic in `.core`, Discord I/O in `.discord` |
| `tier` | `webhook-only` / `two-way` | Tier 1 needs only `webhook-url`; tier 2 also needs `bot-token` + `channel-id` |
| `account_links` | `everyone` / `nobody` / custom | Who may speak from Discord; replace with a real link lookup (see `examples.md`) |
| `inbound_format` | `<color:#5865F2>[Discord]</color> <name>: <message>` | MiniMessage format; `<name>` and `<message>` are inserted as **unparsed** text |
| `avatar_url` | `https://mc-heads.net/avatar/{name}/64` | Webhook avatar per player; empty = Discord's default |
| `max_length` | `200` | Max characters per inbound line (truncated with `…`) |

## Outputs

- Core (no Bukkit, JUnit-testable): `Backoff`, `Payloads` (JSON + escaping), `InboundText` (cleanup + MESSAGE_CREATE filter), `GatewaySession` (protocol state machine)
- Discord I/O (JDK only): `PostQueue` (webhook / bot REST poster), `GatewayClient` (WebSocket driver)
- Plugin: `BridgeConfig` (immutable, masked `toString`), `AccountLinks`, `ChatSink`, `InboundRelay`, `DiscordBridgePlugin`
- Tests: `GatewaySessionTest`, `TextRulesTest`
- `config.yml`, `plugin.yml`

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). **No extra dependencies**: `java.net.http` is part of the JDK and Gson comes transitively with `paper-api` (the server bundles it; do not shade it). Tests use plain JUnit:

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable' // 1.21.11: '1.21.11-R0.1-SNAPSHOT'
    testImplementation 'io.papermc.paper:paper-api:26.2.build.132-stable' // Gson for the core tests
    testImplementation 'org.junit.jupiter:junit-jupiter:5.11.4'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

test {
    useJUnitPlatform()
}
```

## Alternatives

If the server **already runs DiscordSRV** (or another bridge plugin), do not build a second connection to the same bot: hook the existing plugin's API instead, following the [`paper-softdepend-hook`](../paper-softdepend-hook/SKILL.md) pattern (declare it in `softdepend`, keep every reference to its classes inside one Hook class that is only loaded after `isPluginEnabled` returns true, and degrade quietly when it is missing). Two bots on one token fight over the Gateway session, and two webhooks double every message. Build this skill's bridge when you want one channel without a large dependency, or when you need full control over escaping, filtering and who may speak.

## Code Template

### `Backoff.java` (core: reconnect delay)

```java
package com.example.discordbridge.core;

import java.util.function.DoubleSupplier;

/**
 * Reconnect delay: starts at base, doubles per attempt up to max, plus 0-1 s of jitter.
 * Reset after READY / RESUMED. Not thread-safe: used only on the gateway thread.
 */
public final class Backoff {

    private static final int MAX_SHIFT = 30;
    private static final long JITTER_MILLIS = 1000;

    private final long baseMillis;
    private final long maxMillis;
    private final DoubleSupplier jitter;
    private int attempts;

    /** jitter returns a value in [0, 1); tests pass a constant. */
    public Backoff(long baseMillis, long maxMillis, DoubleSupplier jitter) {
        if (baseMillis <= 0 || maxMillis < baseMillis) {
            throw new IllegalArgumentException("need 0 < base <= max");
        }
        this.baseMillis = baseMillis;
        this.maxMillis = maxMillis;
        this.jitter = jitter;
    }

    /** Delay before the next attempt; every call counts as one attempt. */
    public long next() {
        long doubled = baseMillis << Math.min(attempts, MAX_SHIFT);
        if (attempts < MAX_SHIFT) {
            attempts++;
        }
        long capped = doubled <= 0 ? maxMillis : Math.min(maxMillis, doubled);
        return capped + (long) (jitter.getAsDouble() * JITTER_MILLIS);
    }

    public void reset() {
        attempts = 0;
    }
}
```

### `Payloads.java` (core: outbound JSON and escaping)

```java
package com.example.discordbridge.core;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * JSON bodies sent to Discord, and the text rules for them. Pure functions.
 * Every body carries {@code allowed_mentions.parse = []}: no text can ping a user, role, @everyone or @here.
 */
public final class Payloads {

    /** Escaped with a backslash. {@code <} too: {@code <@id>}, {@code <#id>}, {@code <t:...>} render as mentions / timestamps. */
    private static final String MARKDOWN_CHARS = "\\*_~`|<>#[]()-";
    /** Discord rejects webhook usernames that contain these words. */
    private static final Pattern BANNED_NAME = Pattern.compile("clyde|discord", Pattern.CASE_INSENSITIVE);
    private static final String ZERO_WIDTH_SPACE = "​";
    private static final int CONTENT_MAX = 2000;
    private static final int USERNAME_MAX = 80;
    private static final long SUPPRESS_EMBEDS = 1 << 2;

    private Payloads() {
    }

    /** One chat line from a player, sent through a webhook as that player. Empty avatarUrl = Discord default. */
    public static String chatLine(String playerName, String text, String avatarUrl) {
        JsonObject body = base(escapeMarkdown(text));
        body.addProperty("username", webhookName(playerName));
        if (avatarUrl != null && !avatarUrl.isEmpty()) {
            body.addProperty("avatar_url", avatarUrl);
        }
        return body.toString();
    }

    /** A plain announcement; the caller has already escaped any player-controlled part. */
    public static String plain(String content) {
        return base(content).toString();
    }

    /** A bot reply to one message; does not ping the replied-to author. */
    public static String reply(String content, String messageId) {
        JsonObject body = base(content);
        JsonObject reference = new JsonObject();
        reference.addProperty("message_id", messageId);
        reference.addProperty("fail_if_not_exists", false);
        body.add("message_reference", reference);
        body.getAsJsonObject("allowed_mentions").addProperty("replied_user", false);
        return body.toString();
    }

    /** Fills {@code {name}} in the avatar template (URL-encoded); empty template = "". */
    public static String avatar(String template, String playerName) {
        if (template == null || template.isEmpty()) {
            return "";
        }
        return template.replace("{name}", URLEncoder.encode(playerName, StandardCharsets.UTF_8));
    }

    /** CommonMark backslash escaping of {@code \ * _ ~ ` | < > # [ ] ( ) -}. */
    public static String escapeMarkdown(String text) {
        StringBuilder out = new StringBuilder(text.length() + 8);
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (MARKDOWN_CHARS.indexOf(c) >= 0) {
                out.append('\\');
            }
            out.append(c);
        }
        return out.toString();
    }

    /** Webhook username: 1-80 chars, banned words split with U+200B, blank = "?". */
    public static String webhookName(String name) {
        String base = name == null ? "" : name.strip();
        if (base.isEmpty()) {
            return "?";
        }
        String out = BANNED_NAME.matcher(base).replaceAll(m -> {
            String hit = m.group();
            int mid = hit.length() / 2;
            return Matcher.quoteReplacement(hit.substring(0, mid) + ZERO_WIDTH_SPACE + hit.substring(mid));
        });
        return out.length() > USERNAME_MAX ? out.substring(0, USERNAME_MAX) : out;
    }

    private static JsonObject base(String content) {
        JsonObject mentions = new JsonObject();
        mentions.add("parse", new JsonArray());
        JsonObject body = new JsonObject();
        body.addProperty("content", clip(content));
        body.addProperty("flags", SUPPRESS_EMBEDS);
        body.add("allowed_mentions", mentions);
        return body;
    }

    private static String clip(String s) {
        if (s.codePointCount(0, s.length()) <= CONTENT_MAX) {
            return s;
        }
        return s.substring(0, s.offsetByCodePoints(0, CONTENT_MAX));
    }
}
```

### `InboundText.java` (core: filter and clean a MESSAGE_CREATE)

```java
package com.example.discordbridge.core;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Discord message → one safe in-game line. Pure functions.
 * Legacy colour codes (U+00A7 plus the next char), control and format characters (zero-width, bidi overrides)
 * are removed, so the line looks the same in game as it does to chat filters.
 */
public final class InboundText {

    /** One message to deliver in game; immutable, safe to pass between threads. */
    public record Message(String authorId, String authorName, String messageId, String text) {
    }

    private static final Pattern USER = Pattern.compile("<@!?(\\d+)>");
    private static final Pattern ROLE = Pattern.compile("<@&\\d+>");
    private static final Pattern CHANNEL = Pattern.compile("<#\\d+>");
    private static final Pattern EMOJI = Pattern.compile("<a?:(\\w+):\\d+>");
    private static final Pattern LINE_BREAKS = Pattern.compile("[\\r\\n\\t]");
    private static final Pattern MULTI_SPACE = Pattern.compile(" {2,}");
    /** 0 = default, 19 = reply; joins, pins and other system messages are ignored. */
    private static final Set<Integer> ACCEPTED_TYPES = Set.of(0, 19);
    private static final int SECTION_SIGN = 0xA7;
    private static final String ATTACHMENT = "[attachment]";
    private static final String ELLIPSIS = "…";

    private InboundText() {
    }

    /**
     * MESSAGE_CREATE payload → message. Empty when: other channel, author is a bot, has {@code webhook_id}
     * (includes our own outbound webhook messages - this is the echo-loop guard), not a default/reply type,
     * missing author or id, or nothing left after cleaning.
     */
    public static Optional<Message> parse(JsonObject d, String channelId, int maxLength) {
        JsonObject author = object(d, "author");
        String messageId = string(d, "id");
        if (!channelId.equals(string(d, "channel_id")) || author == null || messageId == null
                || bool(author, "bot") || present(d, "webhook_id") || !acceptedType(d)) {
            return Optional.empty();
        }
        String authorId = string(author, "id");
        String authorName = displayName(author);
        if (authorId == null || authorName == null) {
            return Optional.empty();
        }
        boolean hasAttachment = nonEmptyArray(d, "attachments") || nonEmptyArray(d, "sticker_items");
        String text = clean(string(d, "content"), mentionNames(d), hasAttachment, maxLength);
        return text.isEmpty()
                ? Optional.empty()
                : Optional.of(new Message(authorId, stripUnsafe(authorName), messageId, text));
    }

    /** Raw content → one line; "" = do not send. mentionNames: user id → display name. */
    public static String clean(String content, Map<String, String> mentionNames, boolean hasAttachment, int maxLength) {
        String s = content == null ? "" : content;
        s = USER.matcher(s).replaceAll(m -> {
            String name = mentionNames.get(m.group(1));
            return Matcher.quoteReplacement(name == null ? "@someone" : "@" + stripUnsafe(name));
        });
        s = ROLE.matcher(s).replaceAll("@role");
        s = CHANNEL.matcher(s).replaceAll("#channel");
        s = EMOJI.matcher(s).replaceAll(m -> Matcher.quoteReplacement(":" + m.group(1) + ":"));
        s = LINE_BREAKS.matcher(s).replaceAll(" ");
        s = stripUnsafe(s);
        s = MULTI_SPACE.matcher(s).replaceAll(" ").strip();
        if (hasAttachment) {
            s = s.isEmpty() ? ATTACHMENT : s + " " + ATTACHMENT;
        }
        return truncate(s, maxLength);
    }

    /** Removes U+00A7 and the char after it, ISO control characters and Unicode format characters (Cf). */
    static String stripUnsafe(String s) {
        StringBuilder out = new StringBuilder(s.length());
        int i = 0;
        while (i < s.length()) {
            int cp = s.codePointAt(i);
            i += Character.charCount(cp);
            if (cp == SECTION_SIGN) {
                if (i < s.length()) {
                    i += Character.charCount(s.codePointAt(i));
                }
            } else if (!Character.isISOControl(cp) && Character.getType(cp) != Character.FORMAT) {
                out.appendCodePoint(cp);
            }
        }
        return out.toString();
    }

    private static String truncate(String s, int maxLength) {
        if (s.codePointCount(0, s.length()) <= maxLength) {
            return s;
        }
        return s.substring(0, s.offsetByCodePoints(0, Math.max(0, maxLength - 1))) + ELLIPSIS;
    }

    private static Map<String, String> mentionNames(JsonObject d) {
        Map<String, String> names = new HashMap<>();
        JsonElement mentions = d.get("mentions");
        if (mentions == null || !mentions.isJsonArray()) {
            return names;
        }
        for (JsonElement e : mentions.getAsJsonArray()) {
            if (e.isJsonObject()) {
                String id = string(e.getAsJsonObject(), "id");
                String name = displayName(e.getAsJsonObject());
                if (id != null && name != null) {
                    names.put(id, name);
                }
            }
        }
        return names;
    }

    /** global_name when set, otherwise username. */
    private static String displayName(JsonObject user) {
        String global = string(user, "global_name");
        return global != null && !global.isBlank() ? global : string(user, "username");
    }

    private static boolean acceptedType(JsonObject d) {
        JsonElement type = d.get("type");
        return type != null && type.isJsonPrimitive() && type.getAsJsonPrimitive().isNumber()
                && ACCEPTED_TYPES.contains(type.getAsInt());
    }

    private static boolean nonEmptyArray(JsonObject o, String key) {
        JsonElement e = o.get(key);
        return e != null && e.isJsonArray() && !e.getAsJsonArray().isEmpty();
    }

    private static boolean present(JsonObject o, String key) {
        JsonElement e = o.get(key);
        return e != null && !e.isJsonNull();
    }

    private static boolean bool(JsonObject o, String key) {
        JsonElement e = o.get(key);
        return e != null && e.isJsonPrimitive() && e.getAsJsonPrimitive().isBoolean() && e.getAsBoolean();
    }

    private static JsonObject object(JsonObject o, String key) {
        JsonElement e = o.get(key);
        return e != null && e.isJsonObject() ? e.getAsJsonObject() : null;
    }

    private static String string(JsonObject o, String key) {
        JsonElement e = o.get(key);
        return e != null && e.isJsonPrimitive() && e.getAsJsonPrimitive().isString() ? e.getAsString() : null;
    }
}
```

### `GatewaySession.java` (core: Gateway protocol state machine)

```java
package com.example.discordbridge.core;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.DoubleSupplier;

/**
 * Discord Gateway protocol as a pure state machine: input events → list of actions. No network, no Bukkit.
 *
 * <p>Not thread-safe: call only from the single gateway thread; the order of {@code s} and the session is part
 * of correctness.
 *
 * <p>Executor contract: cancel the old heartbeat timer before {@link Connect}; {@link ScheduleHeartbeat}
 * replaces (does not add to) the current timer; after carrying out {@link Close}, always call
 * {@link #onClosed(int)} - it is the only place that schedules a reconnect.
 */
public final class GatewaySession {

    public static final String DEFAULT_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
    /** GUILD_MESSAGES (1 << 9) | MESSAGE_CONTENT (1 << 15) = 33280. */
    public static final int INTENTS = (1 << 9) | (1 << 15);
    /** This many closes in a row without a HELLO → drop the session and use DEFAULT_URL again. */
    static final int MAX_CLOSES_WITHOUT_HELLO = 3;
    static final String NO_GUILDS_WARNING =
            "The bot is not in any Discord server: invite it with the OAuth2 URL Generator (bot scope)";

    private static final String QUERY = "?v=10&encoding=json";
    /** Any close code other than 1000/1001 keeps the session resumable. */
    private static final int CLOSE_KEEP_SESSION = 4000;
    private static final int CLOSE_NORMAL = 1000;
    private static final long INVALID_SESSION_BASE_MILLIS = 1000;
    private static final long INVALID_SESSION_SPREAD_MILLIS = 4000;
    /** 4007 invalid seq, 4009 session timed out: reconnect with a fresh IDENTIFY. */
    private static final Set<Integer> SESSION_INVALIDATING = Set.of(4007, 4009);
    /** Configuration errors: reconnecting would only repeat them (and burn the IDENTIFY quota). */
    private static final Set<Integer> FATAL_CODES = Set.of(4004, 4010, 4011, 4012, 4013, 4014);
    private static final Map<Integer, String> FATAL_REASONS = Map.of(
            4004, "Discord rejected the bot token (4004): check discord.bot-token in config.yml",
            4013, "Invalid intents (4013)",
            4014, "Disallowed intents (4014): enable MESSAGE CONTENT INTENT under Developer Portal > Bot");

    public sealed interface Action permits Connect, Send, ScheduleHeartbeat, Close, Fatal, Dispatch, Warn {
    }

    /** Connect to url after delayMillis. */
    public record Connect(String url, long delayMillis) implements Action {
    }

    /** Send one text frame. toString hides the body: IDENTIFY / RESUME carry the token. */
    public record Send(String json) implements Action {
        @Override
        public String toString() {
            return "Send[" + json.length() + " chars]";
        }
    }

    /** Call onHeartbeatDue after delayMillis; replaces the current heartbeat timer. */
    public record ScheduleHeartbeat(long delayMillis) implements Action {
    }

    /** Close the current socket; code != 1000 keeps the session. Then call onClosed(code). */
    public record Close(int code) implements Action {
    }

    /** Stop reconnecting; reason goes to the console as SEVERE. */
    public record Fatal(String reason) implements Action {
    }

    /** An event for the layer above (only MESSAGE_CREATE). */
    public record Dispatch(String type, JsonObject data) implements Action {
    }

    /** Connection works, but the admin should know about a setup problem. */
    public record Warn(String reason) implements Action {
    }

    /** One gateway text frame; JSON null becomes Java null. */
    public record Frame(int op, Long seq, String type, JsonElement data) {

        /** Broken JSON, not an object, or no numeric op → empty. */
        public static Optional<Frame> parse(String json) {
            JsonObject root;
            try {
                JsonElement parsed = JsonParser.parseString(json);
                if (!parsed.isJsonObject()) {
                    return Optional.empty();
                }
                root = parsed.getAsJsonObject();
            } catch (JsonParseException e) {
                return Optional.empty();
            }
            JsonElement op = present(root.get("op"));
            if (op == null || !isNumber(op)) {
                return Optional.empty();
            }
            JsonElement s = present(root.get("s"));
            JsonElement t = present(root.get("t"));
            return Optional.of(new Frame(
                    op.getAsInt(),
                    s != null && isNumber(s) ? s.getAsLong() : null,
                    t != null && t.isJsonPrimitive() && t.getAsJsonPrimitive().isString() ? t.getAsString() : null,
                    present(root.get("d"))));
        }
    }

    private final String token;
    private final Backoff backoff;
    private final DoubleSupplier jitter;

    private String sessionId;
    private String resumeUrl;
    private Long lastSeq;
    private long intervalMillis;
    private boolean acked;
    private boolean helloSeen;
    private boolean ready;
    private boolean stopped;
    private long pendingDelay = -1;
    private int closesWithoutHello;
    private boolean noGuildsWarned;

    /** jitter returns [0, 1): fraction of the first heartbeat interval and the INVALID_SESSION wait. */
    public GatewaySession(String token, Backoff backoff, DoubleSupplier jitter) {
        this.token = token;
        this.backoff = backoff;
        this.jitter = jitter;
    }

    public List<Action> start() {
        return List.of(new Connect(DEFAULT_URL, 0));
    }

    public List<Action> onFrame(Frame f) {
        if (stopped) {
            return List.of();
        }
        if (f.seq() != null) {
            lastSeq = f.seq();
        }
        return switch (f.op()) {
            case 10 -> onHello(f.data());
            case 11 -> {
                acked = true;
                yield List.of();
            }
            case 1 -> List.of(new Send(heartbeat()));
            case 0 -> onDispatch(f.type(), f.data());
            case 7 -> closeKeepingSession();
            case 9 -> onInvalidSession(f.data());
            default -> List.of();
        };
    }

    /** Heartbeat timer fired. No ACK since the last one → zombie connection: close with 4000 and RESUME. */
    public List<Action> onHeartbeatDue() {
        if (stopped || !helloSeen) {
            return List.of();
        }
        if (!acked) {
            return closeKeepingSession();
        }
        acked = false;
        return List.of(new Send(heartbeat()), new ScheduleHeartbeat(intervalMillis));
    }

    /** The socket is gone (remote close, error, or our own Close). Decides whether and where to reconnect. */
    public List<Action> onClosed(int code) {
        ready = false;
        helloSeen = false;
        if (stopped) {
            return List.of();
        }
        if (FATAL_CODES.contains(code)) {
            stopped = true;
            return List.of(new Fatal(FATAL_REASONS.getOrDefault(code,
                    "Discord closed the gateway with code " + code + "; not reconnecting")));
        }
        closesWithoutHello++;
        if (SESSION_INVALIDATING.contains(code) || closesWithoutHello >= MAX_CLOSES_WITHOUT_HELLO) {
            clearSession();
        }
        long delay = backoff.next();
        if (pendingDelay >= 0) {
            // Still count a backoff step: repeated INVALID_SESSION without READY must not IDENTIFY every few seconds.
            delay = Math.max(pendingDelay, delay);
            pendingDelay = -1;
        }
        String url = sessionId != null && resumeUrl != null ? resumeUrl : DEFAULT_URL;
        return List.of(new Connect(url, delay));
    }

    /** No more reconnects; close with 1000 (Discord invalidates the session). */
    public List<Action> stop() {
        stopped = true;
        return List.of(new Close(CLOSE_NORMAL));
    }

    /** True after READY / RESUMED until the next close. */
    public boolean ready() {
        return ready;
    }

    private List<Action> onHello(JsonElement d) {
        JsonElement interval = d != null && d.isJsonObject() ? d.getAsJsonObject().get("heartbeat_interval") : null;
        if (interval == null || !isNumber(interval)) {
            return closeKeepingSession();
        }
        intervalMillis = interval.getAsLong();
        acked = true;
        helloSeen = true;
        closesWithoutHello = 0;
        String hello = sessionId != null && lastSeq != null ? resume() : identify();
        return List.of(new ScheduleHeartbeat(Math.round(intervalMillis * jitter.getAsDouble())), new Send(hello));
    }

    private List<Action> onDispatch(String type, JsonElement d) {
        if (type == null) {
            return List.of();
        }
        JsonObject data = d != null && d.isJsonObject() ? d.getAsJsonObject() : null;
        switch (type) {
            case "READY" -> {
                if (data != null) {
                    sessionId = string(data, "session_id");
                    resumeUrl = withQuery(string(data, "resume_gateway_url"));
                }
                backoff.reset();
                ready = true;
                return noGuildsWarning(data);
            }
            case "RESUMED" -> {
                backoff.reset();
                ready = true;
                return List.of();
            }
            case "MESSAGE_CREATE" -> {
                return data == null ? List.of() : List.of(new Dispatch(type, data));
            }
            default -> {
                return List.of();
            }
        }
    }

    /** READY with an empty guilds array: connected but will never receive a message. Warn once per session object. */
    private List<Action> noGuildsWarning(JsonObject data) {
        JsonElement guilds = data == null ? null : data.get("guilds");
        if (noGuildsWarned || guilds == null || !guilds.isJsonArray() || !guilds.getAsJsonArray().isEmpty()) {
            return List.of();
        }
        noGuildsWarned = true;
        return List.of(new Warn(NO_GUILDS_WARNING));
    }

    /** d = true: resumable, treat as a normal drop. false: clear the session and wait 1-5 s before IDENTIFY. */
    private List<Action> onInvalidSession(JsonElement d) {
        boolean resumable = d != null && d.isJsonPrimitive() && d.getAsJsonPrimitive().isBoolean() && d.getAsBoolean();
        if (!resumable) {
            clearSession();
            pendingDelay = INVALID_SESSION_BASE_MILLIS + (long) (jitter.getAsDouble() * INVALID_SESSION_SPREAD_MILLIS);
        }
        return closeKeepingSession();
    }

    /** Close with 4000; heartbeats that fire before the next HELLO are ignored (the socket is closing). */
    private List<Action> closeKeepingSession() {
        helloSeen = false;
        return List.of(new Close(CLOSE_KEEP_SESSION));
    }

    private void clearSession() {
        sessionId = null;
        resumeUrl = null;
        lastSeq = null;
    }

    private String identify() {
        JsonObject properties = new JsonObject();
        properties.addProperty("os", "linux");
        properties.addProperty("browser", "DiscordBridge");
        properties.addProperty("device", "DiscordBridge");
        JsonObject d = new JsonObject();
        d.addProperty("token", token);
        d.addProperty("intents", INTENTS);
        d.add("properties", properties);
        return frame(2, d);
    }

    private String resume() {
        JsonObject d = new JsonObject();
        d.addProperty("token", token);
        d.addProperty("session_id", sessionId);
        d.addProperty("seq", lastSeq);
        return frame(6, d);
    }

    private String heartbeat() {
        return lastSeq == null ? "{\"op\":1,\"d\":null}" : "{\"op\":1,\"d\":" + lastSeq + "}";
    }

    private static String frame(int op, JsonObject d) {
        JsonObject root = new JsonObject();
        root.addProperty("op", op);
        root.add("d", d);
        return root.toString();
    }

    /** resume_gateway_url comes as {@code wss://host}; append the same path and query as DEFAULT_URL. */
    static String withQuery(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        if (url.indexOf('?') >= 0) {
            return url;
        }
        int scheme = url.indexOf("://");
        boolean hasPath = url.indexOf('/', scheme < 0 ? 0 : scheme + 3) >= 0;
        return url + (hasPath ? "" : "/") + QUERY;
    }

    private static String string(JsonObject o, String key) {
        JsonElement e = o.get(key);
        return e != null && e.isJsonPrimitive() && e.getAsJsonPrimitive().isString() ? e.getAsString() : null;
    }

    private static JsonElement present(JsonElement e) {
        return e == null || e.isJsonNull() ? null : e;
    }

    private static boolean isNumber(JsonElement e) {
        return e.isJsonPrimitive() && e.getAsJsonPrimitive().isNumber();
    }
}
```

### `PostQueue.java` (Discord I/O: ordered poster on one daemon thread)

```java
package com.example.discordbridge.discord;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Logger;

/**
 * POSTs JSON bodies to one Discord URL (a webhook, or a bot REST route with an Authorization header) in order,
 * on its own daemon thread. Callers (chat thread, main thread) only {@link #enqueue}; they never wait on HTTP.
 *
 * <p>429 → sleep {@code Retry-After} (capped) on this thread, retry <b>once</b>; other failures log one WARNING
 * per minute with the status code only. The URL (a webhook URL is a posting credential) and headers (the bot
 * token) are never logged. Not persisted: whatever is queued at shutdown is dropped - it is only a relay.
 */
public final class PostQueue {

    /** Upper bound on the shutdown wait for the message in flight. */
    public static final long CLOSE_WAIT_MILLIS = 3_000L;
    static final long MAX_RETRY_AFTER_MILLIS = 10_000L;

    private static final int CAPACITY = 200;
    private static final Duration TIMEOUT = Duration.ofSeconds(15);
    private static final long WARN_INTERVAL_NANOS = TimeUnit.MINUTES.toNanos(1);
    private static final long UNREADABLE_RETRY_AFTER_MILLIS = 1_000L;
    /** Discord requires this User-Agent shape for bot REST calls; harmless for webhooks. */
    private static final String USER_AGENT = "DiscordBot (https://example.com, 1.0)";

    private record Item(String json) {
    }

    private record Result(int status, long retryAfterMillis, String failure) {
        boolean ok() {
            return status >= 200 && status < 300;
        }
    }

    /** Wakes an idle worker on close; compared by identity. */
    private static final Item STOP = new Item("");

    private final String label;
    private final String url;
    private final Map<String, String> headers;
    private final Logger logger;
    // No redirects: following one could send the Authorization header to a host nobody configured.
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private final BlockingQueue<Item> queue = new LinkedBlockingQueue<>(CAPACITY);
    private final AtomicLong lastFullWarning = new AtomicLong(System.nanoTime() - WARN_INTERVAL_NANOS);
    private final Thread worker;
    /** Worker thread only. */
    private long lastFailureWarning = System.nanoTime() - WARN_INTERVAL_NANOS;
    private volatile boolean running = true;

    private PostQueue(String label, String url, Map<String, String> headers, Logger logger) {
        this.label = label;
        this.url = url;
        this.headers = Map.copyOf(headers);
        this.logger = logger;
        this.worker = new Thread(this::run, "DiscordBridge-" + label);
        this.worker.setDaemon(true);
    }

    /** Creates the queue and starts its worker. label goes into the thread name and warnings (never the URL). */
    public static PostQueue start(String label, String url, Map<String, String> headers, Logger logger) {
        PostQueue queue = new PostQueue(label, url, headers, logger);
        queue.worker.start();
        return queue;
    }

    /** Any thread; never blocks. Dropped (with a throttled warning) when full or closing. */
    public void enqueue(String json) {
        if (!running) {
            return;
        }
        if (!queue.offer(new Item(json)) && throttle(lastFullWarning)) {
            logger.warning("Discord " + label + " queue is full (" + CAPACITY + "); new messages are dropped. "
                    + "Discord may be unreachable. (at most one warning per minute)");
        }
    }

    public int size() {
        return queue.size();
    }

    /** Step 1 of shutdown, never blocks: accept nothing more, drop the backlog, wake the worker. */
    public void beginClose() {
        running = false;
        queue.clear();
        queue.offer(STOP);
    }

    /** Step 2: wait for the message in flight until deadlineNanos ({@link System#nanoTime()}), then give up. */
    public void awaitClose(long deadlineNanos) {
        try {
            worker.join(Duration.ofNanos(Math.max(0, deadlineNanos - System.nanoTime())));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        if (worker.isAlive()) {
            worker.interrupt();
        }
        http.shutdownNow();
    }

    private void run() {
        try {
            while (running) {
                Item item = queue.poll(1, TimeUnit.SECONDS);
                if (item != null && item != STOP) {
                    send(item.json());
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            http.shutdownNow();
        }
    }

    private void send(String json) throws InterruptedException {
        Result result = post(json);
        if (result.status() == 429) {
            Thread.sleep(result.retryAfterMillis());
            result = post(json);
        }
        if (result.ok() || !running) {
            return;
        }
        long now = System.nanoTime();
        if (now - lastFailureWarning >= WARN_INTERVAL_NANOS) {
            lastFailureWarning = now;
            String cause = result.status() != 0 ? "HTTP " + result.status() : "connection failed: " + result.failure();
            String hint = result.status() == 403 || result.status() == 404
                    ? " Check the webhook URL / the bot's channel permissions."
                    : "";
            logger.warning("Discord " + label + " post failed (" + cause + "); message dropped." + hint
                    + " (at most one warning per minute)");
        }
    }

    private Result post(String json) throws InterruptedException {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(TIMEOUT)
                    .header("User-Agent", USER_AGENT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));
            headers.forEach(request::header);
            HttpResponse<Void> response = http.send(request.build(), HttpResponse.BodyHandlers.discarding());
            int status = response.statusCode();
            String retryAfter = response.headers().firstValue("Retry-After").orElse(null);
            return new Result(status, retryAfterMillis(status, retryAfter), "");
        } catch (IOException | IllegalArgumentException e) {
            // Exception messages may contain the URL: pass on the class name only.
            return new Result(0, 0, e.getClass().getSimpleName());
        }
    }

    /** Retry-After is in seconds, often fractional. Not 429 → 0; missing / unreadable → 1 s; capped. */
    static long retryAfterMillis(int status, String header) {
        if (status != 429) {
            return 0;
        }
        if (header == null) {
            return UNREADABLE_RETRY_AFTER_MILLIS;
        }
        try {
            double seconds = Double.parseDouble(header.trim());
            if (Double.isNaN(seconds)) {
                return UNREADABLE_RETRY_AFTER_MILLIS;
            }
            return Math.max(0, Math.min((long) (seconds * 1000), MAX_RETRY_AFTER_MILLIS));
        } catch (NumberFormatException e) {
            return UNREADABLE_RETRY_AFTER_MILLIS;
        }
    }

    private static boolean throttle(AtomicLong last) {
        long now = System.nanoTime();
        long previous = last.get();
        return now - previous >= WARN_INTERVAL_NANOS && last.compareAndSet(previous, now);
    }
}
```

### `GatewayClient.java` (Discord I/O: runs `GatewaySession` over a JDK WebSocket)

```java
package com.example.discordbridge.discord;

import com.example.discordbridge.core.Backoff;
import com.example.discordbridge.core.GatewaySession;
import com.example.discordbridge.core.GatewaySession.Action;
import com.example.discordbridge.core.GatewaySession.Close;
import com.example.discordbridge.core.GatewaySession.Connect;
import com.example.discordbridge.core.GatewaySession.Dispatch;
import com.example.discordbridge.core.GatewaySession.Fatal;
import com.example.discordbridge.core.GatewaySession.Frame;
import com.example.discordbridge.core.GatewaySession.ScheduleHeartbeat;
import com.example.discordbridge.core.GatewaySession.Send;
import com.example.discordbridge.core.GatewaySession.Warn;
import com.google.gson.JsonObject;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Feeds WebSocket events into {@link GatewaySession} and performs the actions it returns. All protocol
 * decisions live in the session; this class is only I/O.
 *
 * <p><b>One thread.</b> The last sequence number, session id, heartbeat ACK and "which connection is current"
 * are order-dependent, so the session and every mutable field below are touched only on the single
 * "DiscordBridge-Gateway" thread. WebSocket callbacks (JDK HttpClient threads) only {@link #post} work there.
 * {@link #status()} is the only cross-thread read (a volatile snapshot).
 *
 * <p><b>Generation.</b> +1 for every opened and every dropped connection. Callbacks and timers carry the
 * generation they were born with and are ignored on mismatch, so a late onClose of an old socket cannot
 * trigger a second reconnect.
 *
 * <p>MESSAGE_CREATE payloads are handed to {@code onMessageCreate} on the gateway thread: the consumer must not
 * touch Bukkit and must hop to the main thread itself. Logs contain close codes and exception class names only.
 */
public final class GatewayClient {

    public enum State { STOPPED, CONNECTING, CONNECTED, RECONNECTING, FAILED }

    public record Status(State state, String lastError) {
    }

    private static final String THREAD_NAME = "DiscordBridge-Gateway";
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(15);
    private static final long BACKOFF_BASE_MILLIS = 1_000;
    private static final long BACKOFF_MAX_MILLIS = 60_000;
    private static final long STOP_WAIT_NANOS = TimeUnit.SECONDS.toNanos(2);
    /** Connected but no HELLO within this time → treat the connection as dead. */
    private static final long HELLO_TIMEOUT_MILLIS = 30_000;
    private static final int CLOSE_ABNORMAL = 1006;
    private static final int CLOSE_NORMAL = 1000;
    private static final int OP_HELLO = 10;

    private final Logger logger;
    private final Consumer<JsonObject> onMessageCreate;
    private final GatewaySession session;

    private volatile ScheduledThreadPoolExecutor executor;
    private volatile HttpClient http;
    private volatile Status status = new Status(State.STOPPED, "");

    // Gateway thread only.
    private int generation;
    private int connectsIssued;
    private boolean stopping;
    private WebSocket ws;
    private SocketListener listener;
    private CompletableFuture<Void> sendChain = CompletableFuture.completedFuture(null);
    private ScheduledFuture<?> heartbeat;
    private ScheduledFuture<?> pendingConnect;
    private ScheduledFuture<?> helloWatchdog;

    public GatewayClient(String token, Logger logger, Consumer<JsonObject> onMessageCreate) {
        this.logger = logger;
        this.onMessageCreate = onMessageCreate;
        this.session = new GatewaySession(token,
                new Backoff(BACKOFF_BASE_MILLIS, BACKOFF_MAX_MILLIS, GatewayClient::jitter), GatewayClient::jitter);
    }

    /** Main thread, once. Creates the gateway thread and starts the first connection. */
    public void start() {
        if (executor != null) {
            throw new IllegalStateException("GatewayClient can only be started once");
        }
        ScheduledThreadPoolExecutor ex = new ScheduledThreadPoolExecutor(1, runnable -> {
            Thread t = new Thread(runnable, THREAD_NAME);
            t.setDaemon(true);
            return t;
        });
        // After shutdown, drop pending reconnects / heartbeats instead of waiting out a 60 s backoff.
        ex.setExecuteExistingDelayedTasksAfterShutdownPolicy(false);
        ex.setContinueExistingPeriodicTasksAfterShutdownPolicy(false);
        ex.setRemoveOnCancelPolicy(true);
        http = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
        executor = ex;
        status = new Status(State.CONNECTING, "");
        post(() -> apply(session.start()));
    }

    /** Main thread (onDisable). Sends close 1000 on the gateway thread, waits at most 2 s, then shuts down. */
    public void stop() {
        ScheduledThreadPoolExecutor ex = executor;
        HttpClient client = http;
        if (ex == null || client == null || ex.isShutdown()) {
            return;
        }
        long deadline = System.nanoTime() + STOP_WAIT_NANOS;
        CompletableFuture<Void> closing = submitStop(ex, deadline);
        try {
            closing.get(remaining(deadline), TimeUnit.NANOSECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (ExecutionException | TimeoutException e) {
            closing.cancel(false); // no close reply in time: shutdownNow below cuts the socket
        }
        ex.shutdown();
        try {
            if (!ex.awaitTermination(remaining(deadline), TimeUnit.NANOSECONDS)) {
                ex.shutdownNow();
            }
        } catch (InterruptedException e) {
            ex.shutdownNow();
            Thread.currentThread().interrupt();
        }
        client.shutdownNow();
        status = new Status(State.STOPPED, status.lastError());
    }

    /** Any thread. */
    public Status status() {
        return status;
    }

    // ---------- stop ----------

    private CompletableFuture<Void> submitStop(ScheduledThreadPoolExecutor ex, long deadline) {
        try {
            Future<CompletableFuture<Void>> submitted = ex.submit(this::stopOnGatewayThread);
            return submitted.get(remaining(deadline), TimeUnit.NANOSECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (TimeoutException | ExecutionException | RejectedExecutionException e) {
            logger.fine("Gateway stop did not complete: " + rootName(e));
        }
        return CompletableFuture.completedFuture(null);
    }

    /** Completes when close 1000 has been sent and the remote closed (or the connection failed). */
    private CompletableFuture<Void> stopOnGatewayThread() {
        stopping = true;
        cancel(pendingConnect);
        pendingConnect = null;
        CompletableFuture<Void> closing = CompletableFuture.completedFuture(null);
        for (Action action : session.stop()) {
            if (action instanceof Close) {
                closing = closeGracefully();
            }
        }
        status = new Status(State.STOPPED, status.lastError());
        return closing;
    }

    private CompletableFuture<Void> closeGracefully() {
        WebSocket socket = ws;
        SocketListener current = listener;
        dropConnection(false);
        if (socket == null || current == null) {
            return CompletableFuture.completedFuture(null);
        }
        return sendChain
                .thenCompose(v -> socket.sendClose(CLOSE_NORMAL, ""))
                .thenCompose(v -> current.done)
                .handle((v, t) -> null);
    }

    // ---------- connection ----------

    private void connect(Connect action) {
        cancel(heartbeat);
        heartbeat = null;
        cancel(pendingConnect);
        setState(connectsIssued++ == 0 ? State.CONNECTING : State.RECONNECTING);
        String url = action.url();
        pendingConnect = schedule(() -> open(url), action.delayMillis());
    }

    private void open(String url) {
        pendingConnect = null;
        HttpClient client = http;
        if (stopping || client == null) {
            return;
        }
        int gen = ++generation;
        SocketListener l = new SocketListener(gen);
        listener = l;
        try {
            client.newWebSocketBuilder()
                    .connectTimeout(CONNECT_TIMEOUT)
                    .buildAsync(URI.create(url), l)
                    .whenComplete((socket, error) -> {
                        if (error != null) {
                            post(() -> closed(gen, CLOSE_ABNORMAL, rootName(error)));
                        }
                    });
        } catch (IllegalArgumentException e) {
            closed(gen, CLOSE_ABNORMAL, rootName(e)); // bad resume URL: back off like any failed connect
        }
    }

    /** onOpen precedes every onText of the same socket, and post() keeps that order. */
    private void opened(int gen, WebSocket socket) {
        if (gen != generation || stopping) {
            socket.abort();
            return;
        }
        ws = socket;
        sendChain = CompletableFuture.completedFuture(null);
        cancel(helloWatchdog);
        helloWatchdog = schedule(() -> closed(gen, CLOSE_ABNORMAL, "HELLO timeout"), HELLO_TIMEOUT_MILLIS);
    }

    /** Remote close, error or failed connect. Only the first one per connection counts (generation check). */
    private void closed(int gen, int code, String reason) {
        if (gen != generation || stopping) {
            return;
        }
        dropConnection(true);
        status = new Status(status.state(), "close code " + code + (reason.isEmpty() ? "" : " (" + reason + ")"));
        apply(session.onClosed(code));
    }

    /** Invalidate the current connection: its callbacks and heartbeats no longer count. */
    private void dropConnection(boolean abort) {
        generation++;
        cancel(heartbeat);
        heartbeat = null;
        cancel(pendingConnect);
        pendingConnect = null;
        cancel(helloWatchdog);
        helloWatchdog = null;
        WebSocket socket = ws;
        ws = null;
        listener = null;
        if (abort && socket != null) {
            socket.abort();
        }
    }

    private void frame(int gen, String text) {
        if (gen != generation || stopping) {
            return;
        }
        Optional<Frame> f = Frame.parse(text);
        if (f.isEmpty()) {
            logger.fine("Ignored an unparsable gateway frame (" + text.length() + " chars)");
            return;
        }
        if (f.get().op() == OP_HELLO) {
            cancel(helloWatchdog);
            helloWatchdog = null;
        }
        apply(session.onFrame(f.get()));
        if (session.ready() && status.state() != State.CONNECTED) {
            setState(State.CONNECTED);
        }
    }

    private void heartbeatDue(int gen) {
        if (gen == generation && !stopping) {
            apply(session.onHeartbeatDue());
        }
    }

    // ---------- actions ----------

    private void apply(List<Action> actions) {
        for (Action action : actions) {
            switch (action) {
                case Connect c -> connect(c);
                case Send s -> send(s.json());
                case ScheduleHeartbeat h -> scheduleHeartbeat(h.delayMillis());
                case Close c -> {
                    // abort() = non-1000 close from Discord's view: the session stays resumable.
                    dropConnection(true);
                    apply(session.onClosed(c.code()));
                }
                case Fatal f -> {
                    logger.severe(f.reason());
                    status = new Status(State.FAILED, f.reason());
                }
                case Dispatch d -> dispatch(d.data());
                case Warn w -> logger.warning(w.reason());
            }
        }
    }

    /** The JDK WebSocket forbids a send before the previous one completes, so sends are chained. */
    private void send(String json) {
        WebSocket socket = ws;
        if (socket == null) {
            return;
        }
        sendChain = sendChain
                .thenCompose(v -> socket.sendText(json, true))
                .handle((sent, t) -> {
                    if (t != null) {
                        logger.fine("Gateway send failed: " + rootName(t)); // onClose / onError takes over
                    }
                    return null;
                });
    }

    private void scheduleHeartbeat(long delayMillis) {
        cancel(heartbeat);
        int gen = generation;
        heartbeat = schedule(() -> heartbeatDue(gen), delayMillis);
    }

    private void dispatch(JsonObject data) {
        try {
            onMessageCreate.accept(data);
        } catch (RuntimeException e) {
            logger.log(Level.WARNING, "Handling a Discord message failed: " + e.getClass().getName(), e);
        }
    }

    // ---------- threading helpers ----------

    /** Any thread: run task on the gateway thread. False once the executor is shut down. */
    private boolean post(Runnable task) {
        ScheduledThreadPoolExecutor ex = executor;
        if (ex == null) {
            return false;
        }
        try {
            ex.execute(guarded(task));
            return true;
        } catch (RejectedExecutionException e) {
            return false;
        }
    }

    private ScheduledFuture<?> schedule(Runnable task, long delayMillis) {
        ScheduledThreadPoolExecutor ex = executor;
        if (ex == null) {
            return null;
        }
        try {
            return ex.schedule(guarded(task), delayMillis, TimeUnit.MILLISECONDS);
        } catch (RejectedExecutionException e) {
            return null;
        }
    }

    /** execute() would kill the worker and schedule() would swallow the exception silently: log both. */
    private Runnable guarded(Runnable task) {
        return () -> {
            try {
                task.run();
            } catch (RuntimeException e) {
                logger.log(Level.WARNING, "Exception on the gateway thread: " + e.getClass().getName(), e);
            }
        };
    }

    private void setState(State state) {
        status = new Status(state, status.lastError());
    }

    private static void cancel(ScheduledFuture<?> future) {
        if (future != null) {
            future.cancel(false);
        }
    }

    private static long remaining(long deadline) {
        return Math.max(0, deadline - System.nanoTime());
    }

    /** Class name only: exception messages may contain the URL. */
    private static String rootName(Throwable t) {
        Throwable root = t;
        while ((root instanceof CompletionException || root instanceof ExecutionException) && root.getCause() != null) {
            root = root.getCause();
        }
        return root.getClass().getSimpleName();
    }

    private static double jitter() {
        return ThreadLocalRandom.current().nextDouble();
    }

    /** One per connection. The JDK calls it sequentially (next call after request(1)), so no lock is needed. */
    private final class SocketListener implements WebSocket.Listener {

        private final int gen;
        private final StringBuilder text = new StringBuilder();
        /** Completes when this connection ends; stop() waits on it for the close handshake. */
        private final CompletableFuture<Void> done = new CompletableFuture<>();

        SocketListener(int gen) {
            this.gen = gen;
        }

        @Override
        public void onOpen(WebSocket webSocket) {
            if (!post(() -> opened(gen, webSocket))) {
                webSocket.abort();
                return;
            }
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            text.append(data);
            if (last) {
                String whole = text.toString();
                text.setLength(0);
                post(() -> frame(gen, whole));
            }
            webSocket.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            done.complete(null);
            post(() -> closed(gen, statusCode, ""));
            return null;
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            done.complete(null);
            post(() -> closed(gen, CLOSE_ABNORMAL, rootName(error)));
        }
    }
}
```

### `BridgeConfig.java` (immutable config, secrets masked)

```java
package com.example.discordbridge;

import org.bukkit.configuration.ConfigurationSection;

import java.util.logging.Logger;

/**
 * config.yml parsed once into an immutable record. Invalid values log one WARNING naming the <b>key</b>
 * (never the value - it may be a secret) and are treated as empty. toString masks the secrets: the default
 * record toString would print them into any careless log line.
 */
public record BridgeConfig(String botToken, String channelId, String webhookUrl, String avatarUrl,
                           boolean allowUnlinked, String inboundFormat, String notLinkedReply,
                           int maxLength, long replyCooldownMillis) {

    static final String DEFAULT_AVATAR_URL = "https://mc-heads.net/avatar/{name}/64";
    static final String DEFAULT_FORMAT = "<color:#5865F2>[Discord]</color> <gray><name></gray>: <message>";
    static final String DEFAULT_NOT_LINKED = "Link your Minecraft account first to chat in game.";
    private static final String[] WEBHOOK_PREFIXES = {
        "https://discord.com/api/webhooks/", "https://discordapp.com/api/webhooks/"
    };

    public static BridgeConfig parse(ConfigurationSection root, Logger logger) {
        String channel = text(root, "discord.channel-id", "");
        if (!channel.isEmpty() && !channel.chars().allMatch(Character::isDigit)) {
            logger.warning("discord.channel-id is not a channel id (enable Developer Mode, right-click > Copy Channel ID)");
            channel = "";
        }
        String webhook = text(root, "discord.webhook-url", "");
        if (!webhook.isEmpty() && !isWebhook(webhook)) {
            logger.warning("discord.webhook-url is not a Discord webhook URL");
            webhook = "";
        }
        return new BridgeConfig(
                text(root, "discord.bot-token", ""),
                channel,
                webhook,
                text(root, "outbound.avatar-url", DEFAULT_AVATAR_URL),
                root.getBoolean("inbound.allow-unlinked", true),
                text(root, "inbound.format", DEFAULT_FORMAT),
                text(root, "inbound.not-linked-reply", DEFAULT_NOT_LINKED),
                Math.clamp(root.getInt("inbound.max-length", 200), 20, 256),
                Math.clamp(root.getLong("inbound.reply-cooldown-seconds", 600), 0, 86_400) * 1000L);
    }

    /** Tier 1: game → Discord. */
    public boolean outboundEnabled() {
        return !webhookUrl.isEmpty();
    }

    /** Tier 2: Discord → game. */
    public boolean inboundEnabled() {
        return !botToken.isEmpty() && !channelId.isEmpty();
    }

    @Override
    public String toString() {
        return "BridgeConfig[botToken=" + mask(botToken) + ", channelId=" + channelId
                + ", webhookUrl=" + mask(webhookUrl) + ", avatarUrl=" + avatarUrl
                + ", allowUnlinked=" + allowUnlinked + ", maxLength=" + maxLength
                + ", replyCooldownMillis=" + replyCooldownMillis + "]";
    }

    private static boolean isWebhook(String url) {
        for (String prefix : WEBHOOK_PREFIXES) {
            if (url.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private static String text(ConfigurationSection root, String path, String fallback) {
        String value = root.getString(path, fallback);
        return value == null ? "" : value.strip();
    }

    private static String mask(String secret) {
        return secret.isEmpty() ? "" : "***";
    }
}
```

### `AccountLinks.java` (who may speak from Discord)

```java
package com.example.discordbridge;

import java.util.Optional;
import java.util.UUID;

/**
 * Discord user → in-game sender. Called on the <b>main thread</b> only, so implementations may use the Bukkit
 * API or another plugin's main-thread-only API. Empty = this Discord user may not speak in game.
 */
@FunctionalInterface
public interface AccountLinks {

    /** displayName is what players see; playerId is null when the sender is not a linked Minecraft account. */
    record Sender(String displayName, UUID playerId) {
    }

    Optional<Sender> resolve(String discordUserId, String discordName);

    /** Nobody may speak from Discord (inbound effectively read-only; unlinked users get the reply). */
    static AccountLinks nobody() {
        return (id, name) -> Optional.empty();
    }

    /** Everyone in the bridged channel may speak, shown under their Discord name (format marks it as Discord). */
    static AccountLinks everyone() {
        return (id, name) -> Optional.of(new Sender(name, null));
    }
}
```

### `ChatSink.java` (where an inbound line goes)

```java
package com.example.discordbridge;

import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Server;

/** Delivers one cleaned Discord line in game. Called on the <b>main thread</b> only. */
@FunctionalInterface
public interface ChatSink {

    void deliver(AccountLinks.Sender sender, String text);

    /**
     * Broadcast to all players and the console. {@code <name>} and {@code <message>} are inserted with
     * {@link Placeholder#unparsed}: Discord text can never inject MiniMessage tags (click events, colours).
     */
    static ChatSink broadcast(Server server, String format) {
        MiniMessage mm = MiniMessage.miniMessage();
        return (sender, text) -> server.sendMessage(mm.deserialize(format,
                Placeholder.unparsed("name", sender.displayName()),
                Placeholder.unparsed("message", text)));
    }
}
```

### `InboundRelay.java` (main thread: link check → deliver or reply)

```java
package com.example.discordbridge;

import com.example.discordbridge.core.InboundText;
import com.example.discordbridge.core.Payloads;
import com.example.discordbridge.discord.PostQueue;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.LongSupplier;

/**
 * Main thread only (HashMap, AccountLinks and ChatSink contracts). Allowed senders are delivered in game;
 * everyone else gets one bot reply per cooldown, so a chatty unlinked user does not make the bot spam.
 */
public final class InboundRelay {

    private static final int SWEEP_THRESHOLD = 1000;

    private final AccountLinks links;
    private final ChatSink sink;
    private final PostQueue replies;
    private final String notLinkedReply;
    private final long cooldownMillis;
    private final LongSupplier clock;
    private final Map<String, Long> lastReply = new HashMap<>();

    /** replies may be null (no replies); empty notLinkedReply disables replies too. */
    public InboundRelay(AccountLinks links, ChatSink sink, PostQueue replies, String notLinkedReply,
                        long cooldownMillis, LongSupplier clock) {
        this.links = links;
        this.sink = sink;
        this.replies = replies;
        this.notLinkedReply = notLinkedReply;
        this.cooldownMillis = cooldownMillis;
        this.clock = clock;
    }

    public void handle(InboundText.Message message) {
        Optional<AccountLinks.Sender> sender = links.resolve(message.authorId(), message.authorName());
        if (sender.isPresent()) {
            sink.deliver(sender.get(), message.text());
            return;
        }
        if (replies != null && !notLinkedReply.isEmpty() && tryAcquire(message.authorId(), clock.getAsLong())) {
            replies.enqueue(Payloads.reply(notLinkedReply, message.messageId()));
        }
    }

    /** First call true, false within the cooldown; cooldown 0 = always true. */
    private boolean tryAcquire(String discordUserId, long now) {
        if (cooldownMillis <= 0) {
            return true;
        }
        if (lastReply.size() > SWEEP_THRESHOLD) {
            lastReply.values().removeIf(last -> now - last >= cooldownMillis);
        }
        Long last = lastReply.get(discordUserId);
        if (last != null && now - last < cooldownMillis) {
            return false;
        }
        lastReply.put(discordUserId, now);
        return true;
    }
}
```

### `DiscordBridgePlugin.java` (wiring)

```java
package com.example.discordbridge;

import com.example.discordbridge.core.InboundText;
import com.example.discordbridge.core.Payloads;
import com.example.discordbridge.discord.GatewayClient;
import com.example.discordbridge.discord.PostQueue;
import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.plugin.IllegalPluginAccessException;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Assembles the object graph. Tier 1 (webhook-url) and tier 2 (bot-token + channel-id) are independent:
 * either, both or neither may be configured. Config changes need a restart (no live reconnect).
 */
public final class DiscordBridgePlugin extends JavaPlugin implements Listener {

    private static final String API = "https://discord.com/api/v10";

    /** Read on the async chat thread; written on the main thread. */
    private volatile PostQueue chatQueue;
    private volatile String avatarTemplate = "";
    private PostQueue replyQueue;
    private GatewayClient gateway;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        BridgeConfig cfg = BridgeConfig.parse(getConfig(), getLogger());

        if (cfg.outboundEnabled()) {
            avatarTemplate = cfg.avatarUrl();
            chatQueue = PostQueue.start("chat", cfg.webhookUrl(), Map.of(), getLogger());
            getServer().getPluginManager().registerEvents(this, this);
        }
        if (cfg.inboundEnabled()) {
            startInbound(cfg);
        }
        // Never log cfg values other than through its masked toString.
        getLogger().info("Discord bridge: game -> Discord " + onOff(chatQueue != null)
                + ", Discord -> game " + onOff(gateway != null));
    }

    @Override
    public void onDisable() {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(PostQueue.CLOSE_WAIT_MILLIS);
        PostQueue chat = chatQueue;
        chatQueue = null;
        if (chat != null) {
            chat.beginClose();
        }
        if (replyQueue != null) {
            replyQueue.beginClose();
        }
        if (gateway != null) {
            gateway.stop(); // close 1000, waits at most 2 s
            gateway = null;
        }
        if (chat != null) {
            chat.awaitClose(deadline);
        }
        if (replyQueue != null) {
            replyQueue.awaitClose(deadline);
            replyQueue = null;
        }
    }

    /** Async chat thread: only reads the event and enqueues; cancelled (muted, filtered) messages are skipped. */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncChatEvent event) {
        PostQueue queue = chatQueue;
        if (queue == null) {
            return;
        }
        String name = event.getPlayer().getName();
        String text = PlainTextComponentSerializer.plainText().serialize(event.message());
        if (!text.isBlank()) {
            queue.enqueue(Payloads.chatLine(name, text, Payloads.avatar(avatarTemplate, name)));
        }
    }

    private void startInbound(BridgeConfig cfg) {
        String channelId = cfg.channelId();
        int maxLength = cfg.maxLength();
        replyQueue = PostQueue.start("reply", API + "/channels/" + channelId + "/messages",
                Map.of("Authorization", "Bot " + cfg.botToken()), getLogger());
        InboundRelay relay = new InboundRelay(accountLinks(cfg), ChatSink.broadcast(getServer(), cfg.inboundFormat()),
                replyQueue, cfg.notLinkedReply(), cfg.replyCooldownMillis(), System::currentTimeMillis);
        // The consumer runs on the gateway thread: parse there (pure), then hop to the main thread.
        gateway = new GatewayClient(cfg.botToken(), getLogger(),
                d -> InboundText.parse(d, channelId, maxLength).ifPresent(m -> runOnMain(() -> relay.handle(m))));
        gateway.start();
    }

    /** Replace with a real lookup (linking plugin, database, ServicesManager) - see examples.md. */
    private AccountLinks accountLinks(BridgeConfig cfg) {
        return cfg.allowUnlinked() ? AccountLinks.everyone() : AccountLinks.nobody();
    }

    /** Any thread → main thread. Dropped while disabling: nobody is waiting for that line any more. */
    private void runOnMain(Runnable task) {
        if (!isEnabled()) {
            return;
        }
        try {
            getServer().getScheduler().runTask(this, task);
        } catch (IllegalPluginAccessException e) {
            getLogger().fine("Plugin disabling; dropped one Discord message");
        }
    }

    private static String onOff(boolean on) {
        return on ? "on" : "off";
    }
}
```

### `GatewaySessionTest.java` (JUnit, no socket, no sleeping)

```java
package com.example.discordbridge.core;

import com.example.discordbridge.core.GatewaySession.Action;
import com.example.discordbridge.core.GatewaySession.Close;
import com.example.discordbridge.core.GatewaySession.Connect;
import com.example.discordbridge.core.GatewaySession.Dispatch;
import com.example.discordbridge.core.GatewaySession.Fatal;
import com.example.discordbridge.core.GatewaySession.Frame;
import com.example.discordbridge.core.GatewaySession.ScheduleHeartbeat;
import com.example.discordbridge.core.GatewaySession.Send;
import com.example.discordbridge.core.GatewaySession.Warn;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewaySessionTest {

    private static final String TOKEN = "test-token";
    private static final String RESUME_HOST = "wss://gateway-us-east1-b.discord.gg";
    private static final String RESUME_URL = RESUME_HOST + "/?v=10&encoding=json";

    // Backoff jitter 0 → delays are exactly 1000, 2000, ...; session jitter 0.5.
    private final GatewaySession session = new GatewaySession(TOKEN, new Backoff(1000, 60_000, () -> 0.0), () -> 0.5);

    private static Frame frame(String json) {
        return Frame.parse(json).orElseThrow();
    }

    private List<Action> hello() {
        return session.onFrame(frame("{\"op\":10,\"s\":null,\"t\":null,\"d\":{\"heartbeat_interval\":41250}}"));
    }

    private List<Action> ready(long seq, String guilds) {
        return session.onFrame(frame("{\"op\":0,\"s\":" + seq + ",\"t\":\"READY\",\"d\":{\"session_id\":\"sess\","
                + "\"resume_gateway_url\":\"" + RESUME_HOST + "\",\"guilds\":" + guilds + "}}"));
    }

    private void connectAndReady() {
        session.start();
        hello();
        ready(1, "[{\"id\":\"1\"}]");
    }

    private static JsonObject sent(Action action) {
        return JsonParser.parseString(assertInstanceOf(Send.class, action).json()).getAsJsonObject();
    }

    @Test
    void startConnectsToDefaultUrlImmediately() {
        assertEquals(List.of(new Connect(GatewaySession.DEFAULT_URL, 0)), session.start());
        assertEquals(33280, GatewaySession.INTENTS);
    }

    @Test
    void helloSchedulesJitteredHeartbeatAndIdentifies() {
        session.start();
        List<Action> out = hello();

        assertEquals(new ScheduleHeartbeat(20625), out.get(0)); // 41250 * 0.5
        JsonObject identify = sent(out.get(1));
        assertEquals(2, identify.get("op").getAsInt());
        assertEquals(TOKEN, identify.getAsJsonObject("d").get("token").getAsString());
        assertEquals(33280, identify.getAsJsonObject("d").get("intents").getAsInt());
    }

    @Test
    void heartbeatCarriesLastSequenceAndMissingAckClosesKeepingSession() {
        connectAndReady();
        assertTrue(session.ready());

        List<Action> first = session.onHeartbeatDue();
        assertEquals(1, sent(first.get(0)).get("d").getAsLong());
        assertEquals(new ScheduleHeartbeat(41250), first.get(1));

        // No op 11 since the last heartbeat → zombie connection.
        assertEquals(List.of(new Close(4000)), session.onHeartbeatDue());
    }

    @Test
    void ackKeepsTheConnectionAlive() {
        connectAndReady();
        session.onHeartbeatDue();
        session.onFrame(frame("{\"op\":11}"));

        assertInstanceOf(Send.class, session.onHeartbeatDue().get(0));
    }

    @Test
    void reconnectResumesOnResumeUrl() {
        connectAndReady();

        assertEquals(List.of(new Close(4000)), session.onFrame(frame("{\"op\":7,\"d\":null}")));
        assertEquals(List.of(new Connect(RESUME_URL, 1000)), session.onClosed(4000));
        assertFalse(session.ready());

        JsonObject resume = sent(hello().get(1));
        assertEquals(6, resume.get("op").getAsInt());
        assertEquals("sess", resume.getAsJsonObject("d").get("session_id").getAsString());
        assertEquals(1, resume.getAsJsonObject("d").get("seq").getAsLong());
    }

    @Test
    void nonResumableInvalidSessionReidentifiesOnDefaultUrlAfterWait() {
        connectAndReady();

        assertEquals(List.of(new Close(4000)), session.onFrame(frame("{\"op\":9,\"d\":false}")));
        // max(1000 + 0.5 * 4000, backoff 1000) = 3000
        assertEquals(List.of(new Connect(GatewaySession.DEFAULT_URL, 3000)), session.onClosed(4000));
        assertEquals(2, sent(hello().get(1)).get("op").getAsInt());
    }

    @Test
    void fatalCloseCodeStopsReconnecting() {
        connectAndReady();

        assertInstanceOf(Fatal.class, session.onClosed(4014).get(0));
        assertTrue(session.onClosed(1006).isEmpty());
        assertTrue(hello().isEmpty());
    }

    @Test
    void messageCreateIsDispatchedAndSequenceTracked() {
        connectAndReady();

        List<Action> out = session.onFrame(frame(
                "{\"op\":0,\"s\":5,\"t\":\"MESSAGE_CREATE\",\"d\":{\"id\":\"9\",\"content\":\"hi\"}}"));

        Dispatch dispatch = assertInstanceOf(Dispatch.class, out.get(0));
        assertEquals("hi", dispatch.data().get("content").getAsString());
        assertEquals(5, sent(session.onHeartbeatDue().get(0)).get("d").getAsLong());
    }

    @Test
    void readyWithoutGuildsWarnsOnce() {
        session.start();
        hello();

        assertInstanceOf(Warn.class, ready(1, "[]").get(0));
        assertTrue(ready(2, "[]").isEmpty());
    }

    @Test
    void stopClosesNormallyAndNeverReconnects() {
        connectAndReady();

        assertEquals(List.of(new Close(1000)), session.stop());
        assertTrue(session.onClosed(1000).isEmpty());
    }

    @Test
    void malformedFramesAreRejected() {
        assertTrue(Frame.parse("not json").isEmpty());
        assertTrue(Frame.parse("[1,2]").isEmpty());
        assertTrue(Frame.parse("{\"op\":\"x\"}").isEmpty());
    }

    @Test
    void resumeUrlGetsPathAndQuery() {
        assertEquals(RESUME_URL, GatewaySession.withQuery(RESUME_HOST));
        assertEquals("wss://a/b?x=1", GatewaySession.withQuery("wss://a/b?x=1"));
    }
}
```

### `TextRulesTest.java` (JUnit: escaping, payloads, inbound cleanup)

```java
package com.example.discordbridge.core;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TextRulesTest {

    @Test
    void escapesMarkdownAndMentionSyntax() {
        assertEquals("\\*\\*hi\\*\\* \\<@123\\> \\<t:1:R\\>", Payloads.escapeMarkdown("**hi** <@123> <t:1:R>"));
    }

    @Test
    void webhookNameAvoidsBannedWordsAndBlank() {
        assertEquals("Dis​cord", Payloads.webhookName("Discord"));
        assertEquals("?", Payloads.webhookName("  "));
    }

    @Test
    void chatLineDisablesMentionsAndEmbeds() {
        JsonObject body = JsonParser.parseString(Payloads.chatLine("Steve", "@everyone hi", "")).getAsJsonObject();

        assertEquals("@everyone hi", body.get("content").getAsString());
        assertEquals("Steve", body.get("username").getAsString());
        assertEquals(4, body.get("flags").getAsInt());
        assertTrue(body.getAsJsonObject("allowed_mentions").getAsJsonArray("parse").isEmpty());
        assertFalse(body.has("avatar_url"));
    }

    @Test
    void replyDoesNotPingRepliedUser() {
        JsonObject body = JsonParser.parseString(Payloads.reply("no", "42")).getAsJsonObject();

        assertEquals("42", body.getAsJsonObject("message_reference").get("message_id").getAsString());
        assertFalse(body.getAsJsonObject("allowed_mentions").get("replied_user").getAsBoolean());
    }

    @Test
    void avatarTemplateIsUrlEncoded() {
        assertEquals("https://mc-heads.net/avatar/Steve/64", Payloads.avatar("https://mc-heads.net/avatar/{name}/64", "Steve"));
        assertEquals("", Payloads.avatar("", "Steve"));
    }

    @Test
    void cleanResolvesMentionsAndStripsUnsafe() {
        String out = InboundText.clean("hi <@1> <@&2> <#3> <:pog:4>\n§cred‮!", Map.of("1", "Alex"), false, 200);

        assertEquals("hi @Alex @role #channel :pog: red!", out);
    }

    @Test
    void cleanTruncatesAndMarksAttachments() {
        assertEquals("abcd…", InboundText.clean("abcdefgh", Map.of(), false, 5));
        assertEquals("[attachment]", InboundText.clean("", Map.of(), true, 200));
    }

    @Test
    void parseFiltersBotsWebhooksAndOtherChannels() {
        String ok = "{\"id\":\"9\",\"channel_id\":\"100\",\"type\":0,\"content\":\"hello\","
                + "\"author\":{\"id\":\"7\",\"username\":\"alex\",\"global_name\":\"Alex\"}}";
        JsonObject message = JsonParser.parseString(ok).getAsJsonObject();

        assertEquals(Optional.of(new InboundText.Message("7", "Alex", "9", "hello")),
                InboundText.parse(message, "100", 200));
        assertTrue(InboundText.parse(message, "200", 200).isEmpty());

        JsonObject fromWebhook = message.deepCopy();
        fromWebhook.addProperty("webhook_id", "5");
        assertTrue(InboundText.parse(fromWebhook, "100", 200).isEmpty());

        JsonObject fromBot = message.deepCopy();
        fromBot.getAsJsonObject("author").addProperty("bot", true);
        assertTrue(InboundText.parse(fromBot, "100", 200).isEmpty());
    }
}
```

### `config.yml` and `plugin.yml`

```yaml
# config.yml
config-version: 1

discord:
  # SECRET - never paste it anywhere. Developer Portal > Bot > Reset Token.
  # Also enable "MESSAGE CONTENT INTENT" on that page. Empty = Discord -> game off.
  bot-token: ""
  # Channel to bridge (Developer Mode > right-click channel > Copy Channel ID; digits only).
  # The bot needs View Channel, Read Message History and Send Messages there. Empty = Discord -> game off.
  channel-id: ""
  # SECRET - a webhook URL is a posting credential. Channel settings > Integrations > Webhooks.
  # Empty = game -> Discord off.
  webhook-url: ""

outbound:
  # Avatar per player; {name} is replaced (URL-encoded). Empty = Discord's default avatar.
  avatar-url: "https://mc-heads.net/avatar/{name}/64"

inbound:
  # true: anyone in the channel may speak in game under their Discord name.
  # false: nobody (until you plug in a real account-link lookup; see examples.md).
  allow-unlinked: true
  # MiniMessage. <name> and <message> are inserted as plain text (tags in Discord text are not parsed).
  format: "<color:#5865F2>[Discord]</color> <gray><name></gray>: <message>"
  # Bot reply to users who may not speak. Empty = no reply.
  not-linked-reply: "Link your Minecraft account first to chat in game."
  # Characters per Discord message in game (20-256); longer messages are cut with "…".
  max-length: 200
  # Reply at most once per Discord user within this many seconds (0-86400).
  reply-cooldown-seconds: 600
```

```yaml
# plugin.yml
name: DiscordBridge
version: '${version}'
main: com.example.discordbridge.DiscordBridgePlugin
api-version: '26.2'
description: Bridges in-game chat with one Discord channel (webhook out, Gateway in).
```

### Discord setup checklist

| Step | Tier | Where |
|------|------|-------|
| Create a webhook in the channel, copy its URL into `discord.webhook-url` | 1, 2 | Channel settings → Integrations → Webhooks |
| Create an application + bot, copy the token into `discord.bot-token` | 2 | Developer Portal → Applications → Bot |
| Enable **Message Content Intent** (privileged; without it the gateway closes with 4014) | 2 | Developer Portal → Bot → Privileged Gateway Intents |
| Invite the bot with the `bot` scope | 2 | Developer Portal → OAuth2 → URL Generator |
| Grant **View Channel**, **Read Message History**, **Send Messages** in the bridged channel | 2 | Channel settings → Permissions |
| Copy the channel id into `discord.channel-id` | 2 | Discord settings → Advanced → Developer Mode, then right-click the channel |

## Recommended Directory Structure

```
src/main/java/com/example/discordbridge/
├── core/                      <- no Bukkit, no network; tested with JUnit
│   ├── Backoff.java
│   ├── GatewaySession.java    <- the protocol, as a state machine
│   ├── InboundText.java
│   └── Payloads.java
├── discord/                   <- JDK HttpClient / WebSocket only; no Bukkit
│   ├── GatewayClient.java     <- the only class that owns the gateway thread
│   └── PostQueue.java         <- one daemon thread per Discord URL
├── AccountLinks.java / ChatSink.java   <- extension points (main thread)
├── BridgeConfig.java
├── InboundRelay.java
└── DiscordBridgePlugin.java
src/test/java/com/example/discordbridge/core/
├── GatewaySessionTest.java
└── TextRulesTest.java
src/main/resources/{config.yml,plugin.yml}
```

## Thread Safety

| Code | Thread | Rule |
|------|--------|------|
| `onChat(AsyncChatEvent)` | Async chat thread | Reads the event only, then `PostQueue#enqueue` (thread-safe, non-blocking) |
| `PostQueue` worker | Its own daemon thread | The only place that blocks on HTTP or sleeps for `Retry-After`; never the main thread or Bukkit's async pool |
| `GatewaySession`, all `GatewayClient` state | One `DiscordBridge-Gateway` thread | WebSocket callbacks only `post` to it; never touch Bukkit here |
| `InboundText.parse` | Gateway thread | Pure; produces an immutable `Message` that is safe to hand over |
| `InboundRelay`, `AccountLinks`, `ChatSink` | **Main thread** (via `runTask`) | Bukkit API and other plugins' main-thread APIs are allowed here |
| `onDisable` | Main thread | Queues drop their backlog, the gateway sends close 1000; total wait is bounded (2 s + 3 s) |

- Never call `Bukkit.broadcast`, `getPlayer`, `getOfflinePlayer` etc. inside the `GatewayClient` consumer: hop first. `runTask` throws `IllegalPluginAccessException` while the plugin is disabling, so `runOnMain` checks `isEnabled()` and catches it.
- Do not replace the single gateway thread with a pool: heartbeats must carry the latest sequence number and an old socket's late close must not reconnect a second time.
- See [`references/paper-threading.md`](references/paper-threading.md).

## Security

- **Secrets**: bot token and webhook URLs are never logged (`BridgeConfig#toString` masks them; `Send#toString` hides IDENTIFY; HTTP failures log status code / exception class only). Never put them in `/status` output, error messages or bug reports.
- **No pings**: every payload has `allowed_mentions.parse = []`; replies also set `replied_user: false`.
- **No markdown / mention injection** from players: `escapeMarkdown` escapes `<`, so `<@id>`, `<@&id>`, `<#id>`, `<t:…>` stay literal. Embeds are suppressed (`flags: 4`), so links do not unfurl.
- **No MiniMessage injection** from Discord: `Placeholder.unparsed`; colour codes, control and bidi characters are stripped by `InboundText`.
- **Impersonation**: with `allow-unlinked: true` the in-game name is the Discord display name, which anyone can choose. Keep a visible `[Discord]` marker in `format`, or use a real link lookup and show the **Minecraft** name (never fall back to the Discord name for a linked player who has no Minecraft name yet).
- **Echo loop**: messages with `webhook_id` or `author.bot` are ignored, so the plugin's own outbound webhook messages never come back in game.
- **Redirects** are not followed: a redirect could carry the `Authorization` header to another host.

## Fallback

| Error | Cause | Fix |
|------|------|------|
| SEVERE `Disallowed intents (4014)` | Message Content Intent not enabled | Developer Portal → Bot → enable MESSAGE CONTENT INTENT, restart |
| SEVERE `rejected the bot token (4004)` | Wrong / reset token | Paste the current token into `discord.bot-token`, restart (the bridge does not retry fatal codes) |
| Connected but inbound messages arrive with empty `content` | Intent missing on an old session, or messages from a thread / other channel | Enable the intent; only `channel-id` itself is bridged (threads have their own ids) |
| WARNING `not in any Discord server` | Bot never invited | OAuth2 URL Generator with the `bot` scope |
| `post failed (HTTP 403)` on replies | Bot lacks Send Messages / View Channel in the channel | Fix channel permission overrides |
| `post failed (HTTP 404)` on chat | Webhook deleted | Create a new webhook, update `webhook-url` |
| `queue is full` | Discord unreachable for a long time | Nothing is lost in game; the relay drops new lines and recovers by itself |
| Players can ping `@everyone` / roles | Custom payload built without `allowed_mentions` | Always build bodies through `Payloads` |
| Messages appear twice in game | Two bridges on one channel (e.g. DiscordSRV too) | Run one bridge; see Alternatives |
| Server stalls on shutdown | HTTP called on the main thread | Only `enqueue` from game threads; shutdown waits are capped |
| Every reconnect IDENTIFYs again | Session cleared on every close | Expected only after 4007/4009, INVALID_SESSION `false`, or 3 closes without HELLO; otherwise RESUME is used |
