# examples - paper-discord-bridge

## Example 1: Webhook-only death and advancement announcements (tier 1, no bot)

**Input:**
```
base_package: com.example.discordbridge
tier: webhook-only
requirements: post every death message and every announced advancement to an #events channel; no bot, no inbound
```

**Output - `AnnouncementListener.java` (main thread, only enqueues; the vanilla translation is rendered to English by Paper's plain-text serializer):**
```java
package com.example.discordbridge;

import com.example.discordbridge.core.Payloads;
import com.example.discordbridge.discord.PostQueue;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;

/** Death and advancement lines → one webhook. Respects other plugins that hide or change the message. */
public final class AnnouncementListener implements Listener {

    private static final String DEATH_PREFIX = ":skull: ";
    private static final String ADVANCEMENT_PREFIX = ":trophy: ";

    private final PostQueue queue;

    public AnnouncementListener(PostQueue queue) {
        this.queue = queue;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDeath(PlayerDeathEvent event) {
        post(DEATH_PREFIX, event.deathMessage());
    }

    /** message() is null when the advancement does not announce to chat, or the gamerule is off. */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onAdvancement(PlayerAdvancementDoneEvent event) {
        post(ADVANCEMENT_PREFIX, event.message());
    }

    private void post(String prefix, Component message) {
        if (message == null) {
            return;
        }
        String text = PlainTextComponentSerializer.plainText().serialize(message);
        if (!text.isBlank()) {
            // Player names and item names are player-controlled: escape them, keep our own emoji prefix.
            queue.enqueue(Payloads.plain(prefix + Payloads.escapeMarkdown(text)));
        }
    }
}
```

**Wiring (in `DiscordBridgePlugin`, snippet):**
```java
// onEnable, next to the chat queue. Separate webhook = separate channel and separate rate limit bucket.
String events = getConfig().getString("discord.events-webhook-url", "").strip();
if (!events.isEmpty()) {
    eventsQueue = PostQueue.start("events", events, Map.of(), getLogger());
    getServer().getPluginManager().registerEvents(new AnnouncementListener(eventsQueue), this);
}

// onDisable, together with the other queues (same deadline)
if (eventsQueue != null) {
    eventsQueue.beginClose();
    eventsQueue.awaitClose(deadline);
}
```

**`config.yml` addition:**
```yaml
discord:
  # SECRET. Webhook of the #events channel; empty = announcements off.
  events-webhook-url: ""
```

Notes:
- Leave `bot-token` / `channel-id` empty: no Gateway connection, no bot, no privileged intent.
- Discord shows the webhook's own name and avatar for these posts (no per-player `username`), which is what you want for an announcement feed.
- `PlainTextComponentSerializer` on Paper resolves vanilla translation keys (`death.attack.player`, …) to the server's English text; custom translatable components from other plugins may come out as keys, so render those with your own `GlobalTranslator` call first.

---

## Example 2: Two-way chat where only linked accounts may speak

**Input:**
```
tier: two-way
account_links: links.yml (discord user id → Minecraft UUID), written by a /link flow elsewhere
requirements: unlinked Discord users get one reply per 10 minutes; banned players cannot speak from Discord;
              show the Minecraft name in game, never the Discord name
```

**Output - `YamlAccountLinks.java` (loaded once at enable into an immutable map; `resolve` runs on the main thread):**
```java
package com.example.discordbridge;

import org.bukkit.OfflinePlayer;
import org.bukkit.Server;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Logger;

/**
 * links.yml:
 * <pre>
 * links:
 *   "123456789012345678": 069a79f4-44e9-4726-a5be-fca90e38aaf5
 * </pre>
 * Immutable after load. Reload = build a new instance and restart the bridge.
 */
public final class YamlAccountLinks implements AccountLinks {

    private final Server server;
    private final Map<String, UUID> links;

    private YamlAccountLinks(Server server, Map<String, UUID> links) {
        this.server = server;
        this.links = Map.copyOf(links);
    }

    public static YamlAccountLinks load(File file, Server server, Logger logger) {
        Map<String, UUID> links = new HashMap<>();
        ConfigurationSection section = YamlConfiguration.loadConfiguration(file).getConfigurationSection("links");
        if (section != null) {
            for (String discordId : section.getKeys(false)) {
                String raw = section.getString(discordId, "");
                try {
                    links.put(discordId, UUID.fromString(raw.strip()));
                } catch (IllegalArgumentException e) {
                    logger.warning("links.yml: entry " + discordId + " is not a UUID; skipped");
                }
            }
        }
        logger.info("Loaded " + links.size() + " Discord account links");
        return new YamlAccountLinks(server, links);
    }

    @Override
    public Optional<Sender> resolve(String discordUserId, String discordName) {
        UUID playerId = links.get(discordUserId);
        if (playerId == null) {
            return Optional.empty();
        }
        OfflinePlayer player = server.getOfflinePlayer(playerId); // by UUID: no blocking profile lookup
        String name = player.getName();
        // No name = never joined this server. Do not substitute the Discord name: anyone can pick it.
        if (name == null || player.isBanned()) {
            return Optional.empty();
        }
        return Optional.of(new Sender(name, playerId));
    }
}
```

**Wiring (replace `accountLinks` in `DiscordBridgePlugin`, snippet):**
```java
private AccountLinks accountLinks(BridgeConfig cfg) {
    File file = new File(getDataFolder(), "links.yml");
    return file.isFile() ? YamlAccountLinks.load(file, getServer(), getLogger()) : AccountLinks.nobody();
}
```

**`config.yml`:**
```yaml
inbound:
  allow-unlinked: false          # ignored once accountLinks() returns YamlAccountLinks
  format: "<color:#5865F2>[D]</color> <name>: <message>"   # <name> is now the Minecraft name
  not-linked-reply: "Use /link in game first, then you can chat here."
  reply-cooldown-seconds: 600
```

Notes:
- If links live in another plugin, implement `AccountLinks` as a Hook around its API (`paper-service-api` / `paper-softdepend-hook`): `resolve` already runs on the main thread, so main-thread-only APIs are fine; anything that does database I/O must answer from a cache instead of blocking.
- Muted players: check your chat plugin's mute state inside `resolve` (return empty) or inside a custom `ChatSink`.

---

## Example 3: Staff-only channel relayed to players with a permission

**Input:**
```
requirements: a private #staff Discord channel; its messages appear only to players with discordbridge.staff
              (and the console); staff chat from game goes to the same channel through its own webhook
```

**Output - `PermissionChatSink.java`:**
```java
package com.example.discordbridge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Server;
import org.bukkit.entity.Player;

/** Main thread. Delivers to online players holding the permission, plus the console (for the log). */
public final class PermissionChatSink implements ChatSink {

    private final Server server;
    private final String permission;
    private final String format;

    public PermissionChatSink(Server server, String permission, String format) {
        this.server = server;
        this.permission = permission;
        this.format = format;
    }

    @Override
    public void deliver(AccountLinks.Sender sender, String text) {
        Component line = MiniMessage.miniMessage().deserialize(format,
                Placeholder.unparsed("name", sender.displayName()),
                Placeholder.unparsed("message", text));
        for (Player player : server.getOnlinePlayers()) {
            if (player.hasPermission(permission)) {
                player.sendMessage(line);
            }
        }
        server.getConsoleSender().sendMessage(line);
    }
}
```

**Wiring (one Gateway connection serves both channels; snippet in `startInbound`):**
```java
// The bot also needs View Channel / Read Message History / Send Messages in #staff.
InboundRelay staffRelay = new InboundRelay(
        AccountLinks.everyone(),                 // the Discord channel itself is already staff-only
        new PermissionChatSink(getServer(), "discordbridge.staff",
                "<red>[Staff/Discord]</red> <name>: <message>"),
        null, "", 0, System::currentTimeMillis); // no replies in the staff channel

gateway = new GatewayClient(cfg.botToken(), getLogger(), d -> {
    InboundText.parse(d, channelId, maxLength).ifPresent(m -> runOnMain(() -> relay.handle(m)));
    InboundText.parse(d, staffChannelId, maxLength).ifPresent(m -> runOnMain(() -> staffRelay.handle(m)));
});

// Outbound: whatever handles staff chat in game (a command, a "#" prefix listener, …) only enqueues.
staffQueue = PostQueue.start("staff", staffWebhookUrl, Map.of(), getLogger());
// e.g. from the staff chat command (main thread):
staffQueue.enqueue(Payloads.chatLine(player.getName(), message, Payloads.avatar(avatarTemplate, player.getName())));
```

**`plugin.yml` addition:**
```yaml
permissions:
  discordbridge.staff:
    description: Sees messages from the Discord staff channel
    default: op
```

Notes:
- Do not reuse the public webhook for staff lines: a webhook is bound to one channel.
- `InboundText.parse` checks `channel_id` first, so each message matches at most one relay.
- The intents stay the same (`GUILD_MESSAGES | MESSAGE_CONTENT`); a second Gateway connection for the same bot is never needed.
