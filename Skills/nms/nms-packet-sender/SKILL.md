---
name: nms-packet-sender
description: "產生封包發送工具類，透過 ServerPlayer.connection 將 Clientbound 封包推送至客戶端（Paper NMS + Mojang-mapped）/ Generate packet sender utility to push Clientbound packets via ServerPlayer.connection"
---

# NMS Packet Sender / NMS 封包發送器

## 技能名稱 / Skill Name

`nms-packet-sender`

## 目的 / Purpose

產生標準的 NMS 封包發送工具類，涵蓋單人、多人、廣播、延遲發送等情境。所有發送點透過 `ServerPlayer.connection.send(Packet<?>)` 進入 Netty write queue。

### 替代方案 / Alternatives

先確認 Paper API 能不能做到，能就不要送原始封包（升版時不會壞）：
- 只給單一玩家看的世界邊界、時間、天氣、隱藏玩家 → [`paper-client-side-effects`](../../paper/paper-client-side-effects/SKILL.md)
- Action bar、title、boss bar → Adventure（`player.sendActionBar`、`showTitle`、`showBossBar`）
- 需要修改「伺服器原本就會送」的封包 → [`paper-packetevents-filter`](../../paper/paper-packetevents-filter/SKILL.md)

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）

## 觸發條件 / Triggers

- 「封包發送」「packet sender」「自定義封包」「custom packet」
- 「Clientbound」「推送封包」「send packet」
- 「PacketPlayOut」「ProtocolLib 替代」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.network` | 產出類別所在 package |
| `class_name` | `PacketSender` | 工具類名稱 |
| `include_batch` | `true` | 是否產生批次/廣播方法 |
| `include_async` | `true` | 是否產生延遲/非同步發送方法 |

## 輸出產物 / Outputs

- `PacketSender.java` — 主工具類（static 方法）
- `PacketBuilder.java`（選）— 常見 Clientbound 封包建構器

## Paperweight 建置設定 / Build Setup

參見 [`references/paper-nms-platform.md`](references/paper-nms-platform.md)。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## 代碼範本 / Code Template

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

    /** 發送封包給單一玩家（任意執行緒皆可）。 */
    public static void send(Player player, Packet<?> packet) {
        Objects.requireNonNull(player, "player");
        Objects.requireNonNull(packet, "packet");

        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        if (nms.connection == null) return; // 玩家已離線
        nms.connection.send(packet);
    }

    /** 批次發送給多位玩家。 */
    public static void sendAll(Collection<? extends Player> players, Packet<?> packet) {
        for (Player p : players) send(p, packet);
    }

    /** 對伺服器全體玩家廣播封包。 */
    public static void broadcast(Packet<?> packet) {
        sendAll(Bukkit.getOnlinePlayers(), packet);
    }

    /** 對指定世界的玩家廣播封包。 */
    public static void broadcastWorld(World world, Packet<?> packet) {
        sendAll(world.getPlayers(), packet);
    }

    /** 延遲 N tick 後在主執行緒發送。 */
    public static void sendLater(Plugin plugin, Player player, Packet<?> packet, long delayTicks) {
        Bukkit.getScheduler().runTaskLater(plugin, () -> send(player, packet), delayTicks);
    }

    /**
     * 以非同步方式發送（封包需已建構完成，不可在此存取世界狀態）。
     * 適合大量封包批次，不阻塞主執行緒。
     */
    public static void sendAsync(Plugin plugin, Player player, Packet<?> packet) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> send(player, packet));
    }
}
```

### `PacketBuilder.java`（常見 Clientbound 範例）

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

    /** 建立 Action Bar 文字封包（Adventure → NMS 用 Paper 內建的 PaperAdventure 轉換）。 */
    public static ClientboundSetActionBarTextPacket actionBar(Component message) {
        return new ClientboundSetActionBarTextPacket(PaperAdventure.asVanilla(message));
    }

    /** 建立 Title 封包。 */
    public static ClientboundSetTitleTextPacket title(Component title) {
        return new ClientboundSetTitleTextPacket(PaperAdventure.asVanilla(title));
    }

    /**
     * 建立自定義 Plugin Message 封包（CustomPayload）。
     * 1.20.5+ CustomPacketPayload 改用 type() + StreamCodec；任意 channel 的原始位元組
     * 使用 Paper 的 DiscardedPayload(id, byte[]) 承載（與 Player#sendPluginMessage 相同機制）。
     */
    public static ClientboundCustomPayloadPacket customPayload(Identifier channel, byte[] data) {
        return new ClientboundCustomPayloadPacket(new DiscardedPayload(channel, data));
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── network/
    ├── PacketSender.java
    └── PacketBuilder.java
```

## 執行緒安全注意事項 / Thread Safety

- ✅ `PacketSender.send()` 內部呼叫 `connection.send()`，**可在任何執行緒呼叫**（Netty 會自行排入 write queue）
- ⚠️ **封包建構**若依賴世界狀態（Entity ID、Block position），必須在主執行緒完成
- ⚠️ `connection` 欄位在玩家離線時為 `null`，send 前需檢查
- 詳見 [`references/nms-threading.md`](references/nms-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `NullPointerException: connection` | 玩家已離線 | 加上 `if (nms.connection == null) return;` |
| `NoSuchMethodError: send` | NMS 版本不匹配 | 確認 `paperweight.paperDevBundle` 版本與伺服器一致 |
| 封包無效果 | 玩家 tab 未處於 game 階段 | 確認玩家已完成登入（等 `PlayerJoinEvent`） |
| `ClassCastException: CraftPlayer` | 其他外掛替換 Player 實作 | 改用 `player.getClass().getMethod("getHandle")` 反射取得 |
