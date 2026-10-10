# examples — nms-packet-sender

## Example 1: Send an Action Bar to One Player

**Input:**
```
package_name: com.example.network
class_name: PacketSender
include_batch: false
include_async: false
```

**Output — PacketSender.java (simplified):**
```java
package com.example.network;

import net.minecraft.network.protocol.Packet;
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

@SuppressWarnings("UnstableApiUsage")
public final class PacketSender {
    private PacketSender() {}

    public static void send(Player player, Packet<?> packet) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        if (nms.connection == null) return;
        nms.connection.send(packet);
    }
}
```

**Usage:**
```java
import net.kyori.adventure.text.Component;

public void sendWelcome(Player player) {
    ClientboundSetActionBarTextPacket packet =
        PacketBuilder.actionBar(Component.text("Welcome back!"));
    PacketSender.send(player, packet);
}
```

---

## Example 2: Broadcast a Title Server-Wide

**Input:**
```
package_name: com.example.network
class_name: PacketSender
include_batch: true
include_async: false
```

**Output — broadcast method:**
```java
public static void broadcast(Packet<?> packet) {
    for (Player p : Bukkit.getOnlinePlayers()) send(p, packet);
}
```

**Usage:**
```java
ClientboundSetTitleTextPacket title =
    PacketBuilder.title(Component.text("Server restarting soon").color(NamedTextColor.RED));
PacketSender.broadcast(title);
```

---

## Example 3: Delayed Custom Plugin Message

**Input:**
```
package_name: com.example.network
class_name: PacketSender
include_batch: false
include_async: true
```

**Output — sendLater method:**
```java
public static void sendLater(Plugin plugin, Player player, Packet<?> packet, long delayTicks) {
    Bukkit.getScheduler().runTaskLater(plugin, () -> send(player, packet), delayTicks);
}
```

**Usage: send a custom channel packet after 20 ticks (1 second):**
```java
Identifier channel = Identifier.fromNamespaceAndPath("myplugin", "sync_data");
byte[] payload = serializer.encode(data);
Packet<?> packet = PacketBuilder.customPayload(channel, payload);

PacketSender.sendLater(plugin, player, packet, 20L);
```

---

## Example 4: Async Batch Send to a Whole World

**Input:**
```
package_name: com.example.network
class_name: PacketSender
include_batch: true
include_async: true
```

**Output — combined methods:**
```java
public static void broadcastWorld(World world, Packet<?> packet) {
    sendAll(world.getPlayers(), packet);
}

public static void sendAsync(Plugin plugin, Player player, Packet<?> packet) {
    Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> send(player, packet));
}
```

**Usage: build the packet on the main thread, then batch-send async (suited to many players):**
```java
// Main thread: build the packet (depends on entity state)
ClientboundSetEntityMotionPacket motion =
    new ClientboundSetEntityMotionPacket(entity.getId(), entity.getDeltaMovement());

// Switch to async: batch-send to every player in the world
for (Player p : world.getPlayers()) {
    PacketSender.sendAsync(plugin, p, motion);
}
```
