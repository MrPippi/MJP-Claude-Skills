---
id: paper-packetevents-filter
title: Paper PacketEvents Filter
titleZh: PacketEvents 封包過濾
description: Filter and rewrite packets without NMS through a soft-dependent PacketEvents (primary) or ProtocolLib listener, with Hook + Bridge isolation, snapshot-only Netty-thread reads and fail-open behaviour.
descriptionZh: 不碰 NMS 的封包過濾：以 PacketEvents（主）或 ProtocolLib 軟依賴監聽封包，Hook + Bridge 隔離、Netty 執行緒只讀不可變快照、任何例外一律放行（fail-open）。
version: "1.0.0"
status: active
category: paper-network
categoryLabel: Paper 網路
categoryLabelEn: Paper Network
tags: [paper-api, packetevents, protocolib, packet, netty, fail-open]
triggerKeywords:
  - "PacketEvents"
  - "packetevents"
  - "ProtocolLib"
  - "封包過濾"
  - "packet filter"
  - "SYSTEM_CHAT_MESSAGE"
  - "per-viewer lore"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-packetevents-filter/SKILL.md
featured: false
---

# Paper PacketEvents Filter

## 目的

在不使用 NMS、不注入 Netty pipeline 的前提下，過濾或改寫送給特定玩家的封包：隱藏／改寫系統聊天、每位觀看者的物品 lore 注入、對單一玩家隱藏粒子與音效。封包函式庫由伺服器上的 PacketEvents（主）或 ProtocolLib 提供，本插件只 `compileOnly`、不 shade，並以 `softdepend` 宣告。

需要 NMS 封包類別或自行改寫 Netty pipeline 時，請用 `nms-packet-interceptor`；軟依賴的通用做法見 `paper-softdepend-hook`。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證，程式碼兩版相同）
- 純 Paper API，不需要 Paperweight
- 伺服器安裝 packetevents（編譯對象 2.13.0）或 ProtocolLib（5.3.0）
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### PacketEventsHook.java（軟依賴接點，不含封包型別）

```java
import java.util.logging.Level;

public boolean install(FilterState state) {
    if (handles != null) return true;
    if (!Bukkit.getPluginManager().isPluginEnabled("packetevents")) {
        log.warning("packetevents is not installed: packet filters are disabled.");
        return false;
    }
    try {
        handles = PacketEventsBridge.register(state, log);   // Bridge 才碰 PacketEvents 型別
        return true;
    } catch (LinkageError | RuntimeException e) {
        log.log(Level.WARNING, "Could not register packet filters.", e);
        return false;
    }
}
```

### ChatPacketFilter.java（Netty 執行緒、只讀快照、fail-open）

```java
import com.github.retrooper.packetevents.event.PacketListenerAbstract;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSystemChatMessage;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;

public final class ChatPacketFilter extends PacketListenerAbstract {
    @Override
    public void onPacketSend(PacketSendEvent event) {
        if (!guard.active() || event.getPacketType() != PacketType.Play.Server.SYSTEM_CHAT_MESSAGE) return;
        try {
            UUID recipient = event.getUser() == null ? null : event.getUser().getUUID();
            FilterSnapshot snapshot = state.current();          // 不可變快照
            if (recipient == null || !snapshot.chatHidden().contains(recipient)) return;
            WrapperPlayServerSystemChatMessage wrapper = new WrapperPlayServerSystemChatMessage(event);
            if (wrapper.isOverlay()) return;
            String plain = PlainTextComponentSerializer.plainText().serialize(wrapper.getMessage());
            if (!plain.startsWith(snapshot.allowedPrefix())) event.setCancelled(true);
        } catch (RuntimeException | LinkageError e) {
            guard.trip(e);                                      // 放行並停用，只記一次
        }
    }
}
```

### 生命週期

```java
// onEnable
packetEvents = new PacketEventsHook(getLogger());
if (!packetEvents.install(state)) {          // PacketEvents 優先，ProtocolLib 備援
    protocolLib = new ProtocolLibHook(this);
    protocolLib.install(state);
}
// onDisable
packetEvents.uninstall();
```

---

## 規則

- 封包函式庫型別只出現在 listener 與 Bridge；Hook、Plugin、Bukkit Listener 的欄位與方法簽名都不得出現
- Netty 執行緒只讀 `FilterState#current()`，不呼叫 `Bukkit.*` / `Player.*`（UUID 例外），物品只改 clone
- 任何例外一律 fail-open：放行原封包、`guard.trip(e)` 停用該過濾器並只記一次
- `setCancelled(true)` / `markForReEncode(true)` 放在 try 最後一行
- 創造模式觀看者不注入 lore，並在 `CREATIVE_INVENTORY_ACTION` 剝除標記行
- 不呼叫 PacketEvents 的 `load()` / `init()` / `terminate()`；`onDisable` 一定取消註冊

---

## 執行緒安全

- PacketEvents／ProtocolLib 的監聽器在 Netty 執行緒，不是主執行緒
- 設定、玩家狀態在主執行緒組成新的 `FilterSnapshot` 後以 `FilterState#update` 發布
- 重送封包（`updateInventory()` 或 `PlayerManager#sendPacket`）在主執行緒呼叫，且先改狀態再重送
