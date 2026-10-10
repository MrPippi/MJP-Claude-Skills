# NMS Packet Sender

## Purpose

Generate a standard NMS packet sender utility class covering single-player, multi-player, broadcast, and delayed sending. Every send goes through `ServerPlayer.connection.send(Packet<?>)` into the Netty write queue.

---

## Alternatives

First check whether the Paper API can do it: per-player world border / time / weather / hidden players are covered in `paper-client-side-effects`; use Adventure for action bar, title, and boss bar; to rewrite packets the server would send anyway, see `paper-packetevents-filter`.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with trailing `// @1.21.11:` comments)
- Paperweight userdev 2.0.0-beta.24+
- Official Mojang names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### PacketSender.java

```java
@SuppressWarnings("UnstableApiUsage")
public final class PacketSender {

    public static void send(Player player, Packet<?> packet) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        if (nms.connection == null) return;
        nms.connection.send(packet);
    }

    public static void broadcast(Packet<?> packet) {
        Bukkit.getOnlinePlayers().forEach(p -> send(p, packet));
    }

    public static void sendLater(Plugin plugin, Player player, Packet<?> packet, long delayTicks) {
        Bukkit.getScheduler().runTaskLater(plugin, () -> send(player, packet), delayTicks);
    }
}
```

### PacketBuilder.java (Action Bar / Title / CustomPayload)

```java
// Action Bar
ClientboundSetActionBarTextPacket actionBar(Component message)

// Title
ClientboundSetTitleTextPacket title(Component title)

// Plugin Message
ClientboundCustomPayloadPacket customPayload(Identifier channel, byte[] data)
```

---

## Thread Safety

- `send()` can be called from any thread (Netty queues it in the write queue)
- If packet contents depend on world state, build them on the main thread
- The `connection` field is null when the player is offline; check it first
