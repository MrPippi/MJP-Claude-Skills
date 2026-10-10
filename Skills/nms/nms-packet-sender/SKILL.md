---
name: nms-packet-sender
description: "產生封包發送工具類，透過 ServerPlayer.connection 將 Clientbound 封包推送至客戶端（Paper NMS + Mojang-mapped）/ Generate packet sender utility to push Clientbound packets via ServerPlayer.connection"
---

# NMS Packet Sender

## Skill Name

`nms-packet-sender`

## Purpose

Generates a standard NMS packet sender utility class covering single-player, multi-player, broadcast, and delayed sending. Every send goes through `ServerPlayer.connection.send(Packet<?>)` into the Netty write queue.

### Alternatives

First check whether the Paper API can do it; if so, do not send raw packets (the API survives version upgrades):
- Per-player world border, time, weather, or hidden players -> [`paper-client-side-effects`](../../paper/paper-client-side-effects/SKILL.md)
- Action bar, title, boss bar -> Adventure (`player.sendActionBar`, `showTitle`, `showBossBar`)
- Modifying packets the server already sends -> [`paper-packetevents-filter`](../../paper/paper-packetevents-filter/SKILL.md)

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- 「封包發送」「packet sender」「自定義封包」「custom packet」
- 「Clientbound」「推送封包」「send packet」
- 「PacketPlayOut」「ProtocolLib 替代」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.network` | Package of the generated classes |
| `class_name` | `PacketSender` | Utility class name |
| `include_batch` | `true` | Whether to generate batch/broadcast methods |
| `include_async` | `true` | Whether to generate delayed/async send methods |

## Outputs

- `PacketSender.java` - main utility class (static methods)
- `PacketBuilder.java`(optional) - builder for common Clientbound packets

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `PacketSender.java`

```java
package com.example.network;

import net.minecraft.network.protocol.Packet;
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.Collection;
import java.util.Objects;

@SuppressWarnings("UnstableApiUsage")
public final class PacketSender {

    private PacketSender() {}

    /** Sends a packet to a single player (safe from any thread). */
    public static void send(Player player, Packet<?> packet) {
        Objects.requireNonNull(player, "player");
        Objects.requireNonNull(packet, "packet");

        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        if (nms.connection == null) return; // Player is offline
        nms.connection.send(packet);
    }

    /** Sends a packet to multiple players. */
    public static void sendAll(Collection<? extends Player> players, Packet<?> packet) {
        for (Player p : players) send(p, packet);
    }

    /** Broadcasts a packet to every online player. */
    public static void broadcast(Packet<?> packet) {
        sendAll(Bukkit.getOnlinePlayers(), packet);
    }

    /** Broadcasts a packet to the players of a given world. */
    public static void broadcastWorld(World world, Packet<?> packet) {
        sendAll(world.getPlayers(), packet);
    }

    /** Sends on the main thread after N ticks. */
    public static void sendLater(Plugin plugin, Player player, Packet<?> packet, long delayTicks) {
        Bukkit.getScheduler().runTaskLater(plugin, () -> send(player, packet), delayTicks);
    }

    /**
     * Sends asynchronously (the packet must already be built; do not access world state here).
     * Suited to large packet batches without blocking the main thread.
     */
    public static void sendAsync(Plugin plugin, Player player, Packet<?> packet) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> send(player, packet));
    }
}
```

### `PacketBuilder.java` (common Clientbound examples)

```java
package com.example.network;

import io.papermc.paper.adventure.PaperAdventure;
import net.kyori.adventure.text.Component;
import net.minecraft.network.protocol.common.ClientboundCustomPayloadPacket;
import net.minecraft.network.protocol.common.custom.DiscardedPayload;
import net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;
import net.minecraft.resources.Identifier;

@SuppressWarnings("UnstableApiUsage")
public final class PacketBuilder {

    private PacketBuilder() {}

    /** Builds an Action Bar text packet (Adventure -> NMS via Paper's built-in PaperAdventure). */
    public static ClientboundSetActionBarTextPacket actionBar(Component message) {
        return new ClientboundSetActionBarTextPacket(PaperAdventure.asVanilla(message));
    }

    /** Builds a Title packet. */
    public static ClientboundSetTitleTextPacket title(Component title) {
        return new ClientboundSetTitleTextPacket(PaperAdventure.asVanilla(title));
    }

    /**
     * Builds a custom Plugin Message packet (CustomPayload).
     * Since 1.20.5, CustomPacketPayload uses type() + StreamCodec; raw bytes for any channel
     * are carried by Paper's DiscardedPayload(id, byte[]) (same mechanism as Player#sendPluginMessage).
     */
    public static ClientboundCustomPayloadPacket customPayload(Identifier channel, byte[] data) {
        return new ClientboundCustomPayloadPacket(new DiscardedPayload(channel, data));
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── network/
    ├── PacketSender.java
    └── PacketBuilder.java
```

## Thread Safety

- ✅ `PacketSender.send()` calls `connection.send()` internally and is **safe to call from any thread** (Netty queues the write itself)
- ⚠️ **Packet construction** that depends on world state (entity ID, block position) must happen on the main thread
- ⚠️ The `connection` field is `null` when the player is offline; check before sending
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| `NullPointerException: connection` | Player is offline | Add `if (nms.connection == null) return;` |
| `NoSuchMethodError: send` | NMS version mismatch | Make sure the `paperweight.paperDevBundle` version matches the server |
| Packet has no effect | Player is not in the game phase yet | Make sure the player finished logging in (wait for `PlayerJoinEvent`) |
| `ClassCastException: CraftPlayer` | Another plugin replaces the Player implementation | Obtain the handle via reflection with `player.getClass().getMethod("getHandle")` |
