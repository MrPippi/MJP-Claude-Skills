# examples — nms-packet-sender

## 範例 1：單人發送 Action Bar

**Input:**
```
package_name: com.example.network
class_name: PacketSender
include_batch: false
include_async: false
```

**Output — PacketSender.java (簡化版):**
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

**使用端:**
```java
import net.kyori.adventure.text.Component;

public void sendWelcome(Player player) {
    ClientboundSetActionBarTextPacket packet =
        PacketBuilder.actionBar(Component.text("歡迎回來！"));
    PacketSender.send(player, packet);
}
```

---

## 範例 2：全伺服器廣播 Title

**Input:**
```
package_name: com.example.network
class_name: PacketSender
include_batch: true
include_async: false
```

**Output — broadcast 方法:**
```java
public static void broadcast(Packet<?> packet) {
    for (Player p : Bukkit.getOnlinePlayers()) send(p, packet);
}
```

**使用端:**
```java
ClientboundSetTitleTextPacket title =
    PacketBuilder.title(Component.text("伺服器即將重啟").color(NamedTextColor.RED));
PacketSender.broadcast(title);
```

---

## 範例 3：延遲發送自定義 Plugin Message

**Input:**
```
package_name: com.example.network
class_name: PacketSender
include_batch: false
include_async: true
```

**Output — sendLater 方法:**
```java
public static void sendLater(Plugin plugin, Player player, Packet<?> packet, long delayTicks) {
    Bukkit.getScheduler().runTaskLater(plugin, () -> send(player, packet), delayTicks);
}
```

**使用端：20 tick（1 秒）後發送一個自定義 channel 封包:**
```java
Identifier channel = Identifier.fromNamespaceAndPath("myplugin", "sync_data");
byte[] payload = serializer.encode(data);
Packet<?> packet = PacketBuilder.customPayload(channel, payload);

PacketSender.sendLater(plugin, player, packet, 20L);
```

---

## 範例 4：非同步批次發送至整個世界

**Input:**
```
package_name: com.example.network
class_name: PacketSender
include_batch: true
include_async: true
```

**Output — 組合方法:**
```java
public static void broadcastWorld(World world, Packet<?> packet) {
    sendAll(world.getPlayers(), packet);
}

public static void sendAsync(Plugin plugin, Player player, Packet<?> packet) {
    Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> send(player, packet));
}
```

**使用端：主執行緒建構封包，async 批次發送（適合大量玩家場景）:**
```java
// 主執行緒：建構封包（依賴 entity 狀態）
ClientboundSetEntityMotionPacket motion =
    new ClientboundSetEntityMotionPacket(entity.getId(), entity.getDeltaMovement());

// 切 async：批次發送給世界所有玩家
for (Player p : world.getPlayers()) {
    PacketSender.sendAsync(plugin, p, motion);
}
```
