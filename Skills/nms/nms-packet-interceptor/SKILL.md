---
name: nms-packet-interceptor
description: "透過 Netty ChannelDuplexHandler 注入玩家連線管線，攔截/修改 Clientbound 與 Serverbound 封包 / Intercept and modify packets via Netty pipeline injection"
---

# NMS Packet Interceptor / NMS 封包攔截器

## 技能名稱 / Skill Name

`nms-packet-interceptor`

## 目的 / Purpose

在玩家的 Netty 連線管線中注入自訂 `ChannelDuplexHandler`，於封包進入/離開伺服器時進行讀取、修改或取消。常用於反外掛、封包記錄、自訂通訊協議、偽造資訊等場景。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev 2.0.0-beta.24+
- Netty 4.x（Paper 內建）

## 觸發條件 / Triggers

- 「封包攔截」「packet intercept」「netty pipeline」
- 「channel handler」「封包監聽」「修改封包」
- 「packet listener」「anti-cheat packet」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.network` | 產出類別所在 package |
| `handler_name` | `PacketInterceptor` | Handler 類別名稱 |
| `manager_name` | `InterceptorManager` | 管理器類別名稱 |
| `handler_id` | `myplugin_interceptor` | Netty pipeline 中的 handler 名稱（須唯一） |

## 輸出產物 / Outputs

- `PacketInterceptor.java` — `ChannelDuplexHandler` 實作
- `InterceptorManager.java` — 監聽 Join/Quit 事件管理注入/移除
- `InterceptorListener.java` — Bukkit 事件監聽器

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。Netty 隨 Paper 提供，無需額外依賴。

## 代碼範本 / Code Template

### `PacketInterceptor.java`

```java
package com.example.network;

import io.netty.channel.ChannelDuplexHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelPromise;
import net.minecraft.network.protocol.Packet;
import org.bukkit.entity.Player;

import java.util.UUID;
import java.util.function.BiFunction;

@SuppressWarnings("UnstableApiUsage")
public final class PacketInterceptor extends ChannelDuplexHandler {

    private final UUID playerId;
    private final BiFunction<Player, Packet<?>, Packet<?>> inboundFilter;
    private final BiFunction<Player, Packet<?>, Packet<?>> outboundFilter;

    public PacketInterceptor(
        Player player,
        BiFunction<Player, Packet<?>, Packet<?>> inboundFilter,
        BiFunction<Player, Packet<?>, Packet<?>> outboundFilter
    ) {
        this.playerId = player.getUniqueId();
        this.inboundFilter = inboundFilter;
        this.outboundFilter = outboundFilter;
    }

    /** Serverbound：客戶端 → 伺服器。 */
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        if (msg instanceof Packet<?> packet) {
            Player player = org.bukkit.Bukkit.getPlayer(playerId);
            if (player != null && inboundFilter != null) {
                Packet<?> modified = inboundFilter.apply(player, packet);
                if (modified == null) return; // 取消封包
                msg = modified;
            }
        }
        super.channelRead(ctx, msg);
    }

    /** Clientbound：伺服器 → 客戶端。 */
    @Override
    public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
        if (msg instanceof Packet<?> packet) {
            Player player = org.bukkit.Bukkit.getPlayer(playerId);
            if (player != null && outboundFilter != null) {
                Packet<?> modified = outboundFilter.apply(player, packet);
                if (modified == null) return; // 取消封包
                msg = modified;
            }
        }
        super.write(ctx, msg, promise);
    }
}
```

### `InterceptorManager.java`

```java
package com.example.network;

import io.netty.channel.Channel;
import net.minecraft.network.Connection;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.protocol.Packet;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

import java.util.function.BiFunction;

@SuppressWarnings("UnstableApiUsage")
public final class InterceptorManager {

    private static final String HANDLER_ID = "myplugin_interceptor";

    private final BiFunction<Player, Packet<?>, Packet<?>> inboundFilter;
    private final BiFunction<Player, Packet<?>, Packet<?>> outboundFilter;

    public InterceptorManager(
        BiFunction<Player, Packet<?>, Packet<?>> inboundFilter,
        BiFunction<Player, Packet<?>, Packet<?>> outboundFilter
    ) {
        this.inboundFilter = inboundFilter;
        this.outboundFilter = outboundFilter;
    }

    /** 在玩家 join 時注入 handler 至 pipeline。 */
    public void inject(Player player) {
        Channel channel = getChannel(player);
        if (channel == null || channel.pipeline().get(HANDLER_ID) != null) return;

        PacketInterceptor interceptor = new PacketInterceptor(player, inboundFilter, outboundFilter);
        // 放在 vanilla "packet_handler" 前面（即我們先看到封包）
        channel.pipeline().addBefore("packet_handler", HANDLER_ID, interceptor);
    }

    /** 在玩家 quit 時移除 handler。 */
    public void uninject(Player player) {
        Channel channel = getChannel(player);
        if (channel == null || channel.pipeline().get(HANDLER_ID) == null) return;

        channel.eventLoop().execute(() -> {
            if (channel.pipeline().get(HANDLER_ID) != null) {
                channel.pipeline().remove(HANDLER_ID);
            }
        });
    }

    private Channel getChannel(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        Connection connection = nms.connection.connection;
        return connection != null ? connection.channel : null;
    }
}
```

### `InterceptorListener.java`

```java
package com.example.network;

import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

public final class InterceptorListener implements Listener {

    private final InterceptorManager manager;

    public InterceptorListener(InterceptorManager manager) {
        this.manager = manager;
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onJoin(PlayerJoinEvent event) {
        manager.inject(event.getPlayer());
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        manager.uninject(event.getPlayer());
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── network/
    ├── PacketInterceptor.java
    ├── InterceptorManager.java
    └── InterceptorListener.java
```

## 執行緒安全注意事項 / Thread Safety

- ⚠️ `channelRead` 與 `write` 皆在 **Netty IO 執行緒**執行，禁止存取 `Level`/`Entity`/呼叫阻塞 IO
- ⚠️ 需存取世界狀態 → `Bukkit.getScheduler().runTask(plugin, () -> { ... })`
- ⚠️ Filter function 中不可呼叫 `player.teleport()` 等 Bukkit 同步 API
- ✅ 移除 handler 時必須透過 `channel.eventLoop().execute()`，避免 pipeline race condition
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `NoSuchElementException: packet_handler` | Netty pipeline handler 名稱變更 | 檢查 Paper 對應版本的 `Connection.java` |
| Handler 未觸發 | 注入時機太晚（封包已流經） | 用 `PlayerJoinEvent` 的 `LOWEST` 優先級 |
| Handler 造成延遲 | Filter function 內有阻塞操作 | 將阻塞操作丟至 async task，filter 僅做輕量判斷 |
| `IllegalStateException: Handler already added` | 重複注入 | 每次 inject 前檢查 `pipeline().get(HANDLER_ID)` |
| Server 關閉時 `ClosedChannelException` | 關服流程中 pipeline 已關閉 | 忽略此錯誤，或在 `onDisable` 先 uninject 所有玩家 |
