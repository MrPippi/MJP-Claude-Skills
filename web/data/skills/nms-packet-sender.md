---
id: nms-packet-sender
title: NMS Packet Sender
titleZh: NMS 封包發送器
description: Generate a packet sender utility to push Clientbound NMS packets via ServerPlayer.connection on Paper 1.21.x with Mojang mappings.
descriptionZh: 產生封包發送工具類，透過 ServerPlayer.connection 將 Clientbound 封包推送至客戶端（Paper NMS + Mojang mappings）。
version: "1.0.0"
status: active
category: nms-packet
categoryLabel: NMS 封包
categoryLabelEn: NMS Packet
tags: [nms, packet, netty, paperweight, clientbound, mojang-mapped]
triggerKeywords:
  - "封包發送"
  - "packet sender"
  - "自定義封包"
  - "custom packet"
  - "Clientbound"
  - "推送封包"
  - "send packet"
updatedAt: "2026-04-19"
githubPath: Skills/nms/nms-packet-sender/SKILL.md
featured: true
---

# NMS Packet Sender

## 目的

產生標準的 NMS 封包發送工具類，涵蓋單人、多人、廣播、延遲發送等情境。所有發送點透過 `ServerPlayer.connection.send(Packet<?>)` 進入 Netty write queue。

---

## 平台需求

- Paper 1.21 – 1.21.3
- Paperweight userdev 2.0.0-beta.24+
- Mojang mappings（Paper 1.20.5+ 原生支援）
- Java 21

---

## 產生的代碼

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

### PacketBuilder.java（Action Bar / Title / CustomPayload）

```java
// Action Bar
ClientboundSetActionBarTextPacket actionBar(Component message)

// Title
ClientboundSetTitleTextPacket title(Component title)

// Plugin Message
ClientboundCustomPayloadPacket customPayload(ResourceLocation channel, byte[] data)
```

---

## 執行緒安全

- `send()` 可在任意執行緒呼叫（Netty 排入 write queue）
- 封包內容建構若依賴世界狀態，必須在主執行緒完成
- `connection` 欄位在玩家離線時為 null，需先檢查
