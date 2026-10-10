---
name: nms-packet-interceptor
description: "透過 Netty ChannelDuplexHandler 注入玩家連線管線，攔截/修改 Clientbound 與 Serverbound 封包 / Intercept and modify packets via Netty pipeline injection"
---

# NMS Packet Interceptor

## Skill Name

`nms-packet-interceptor`

## Purpose

Inject a custom `ChannelDuplexHandler` into the player's Netty connection pipeline to read, modify, or cancel packets as they enter or leave the server. Commonly used for anti-cheat, packet logging, custom protocols, and spoofing information.

### Alternatives

- **Prefer to avoid NMS/Netty**: use PacketEvents (or ProtocolLib) as a soft dependency, see [`paper-packetevents-filter`](../../paper/paper-packetevents-filter/SKILL.md). BlockoSMP and Bydsmp both take this route.
- Either way, follow **fail-open**: when the interceptor errors, let the packet pass through as usual, disable itself, and log only once. Never disconnect or stall the player.

## NMS Version Requirements

- Paper 1.21.11 / 26.2(both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Netty 4.x(bundled with Paper)

## Triggers

- "封包攔截", "packet intercept", "netty pipeline"
- "channel handler", "封包監聽", "修改封包"
- "packet listener", "anti-cheat packet"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.network` | Package of the generated classes |
| `handler_name` | `PacketInterceptor` | Handler class name |
| `manager_name` | `InterceptorManager` | Manager class name |
| `handler_id` | `myplugin_interceptor` | Handler name in the Netty pipeline (must be unique) |

## Outputs

- `PacketInterceptor.java` — `ChannelDuplexHandler` implementation
- `InterceptorManager.java` — handles injection/removal on Join/Quit events
- `InterceptorListener.java` — Bukkit event listener

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Netty ships with Paper, so no extra dependency is needed.

## Code Template

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

    /** Serverbound: client -> server. */
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        if (msg instanceof Packet<?> packet) {
            Player player = org.bukkit.Bukkit.getPlayer(playerId);
            if (player != null && inboundFilter != null) {
                Packet<?> modified = inboundFilter.apply(player, packet);
                if (modified == null) return; // cancel the packet
                msg = modified;
            }
        }
        super.channelRead(ctx, msg);
    }

    /** Clientbound: server -> client. */
    @Override
    public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
        if (msg instanceof Packet<?> packet) {
            Player player = org.bukkit.Bukkit.getPlayer(playerId);
            if (player != null && outboundFilter != null) {
                Packet<?> modified = outboundFilter.apply(player, packet);
                if (modified == null) return; // cancel the packet
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

    /** Injects the handler into the pipeline when a player joins. */
    public void inject(Player player) {
        Channel channel = getChannel(player);
        if (channel == null || channel.pipeline().get(HANDLER_ID) != null) return;

        PacketInterceptor interceptor = new PacketInterceptor(player, inboundFilter, outboundFilter);
        // Place before vanilla "packet_handler" (so we see packets first)
        channel.pipeline().addBefore("packet_handler", HANDLER_ID, interceptor);
    }

    /** Removes the handler when a player quits. */
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

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── network/
    ├── PacketInterceptor.java
    ├── InterceptorManager.java
    └── InterceptorListener.java
```

## Thread Safety

- ⚠️ `channelRead` and `write` both run on the **Netty IO thread**; do not access `Level`/`Entity` or call blocking IO
- ⚠️ To access world state, use `Bukkit.getScheduler().runTask(plugin, () -> { ... })`
- ⚠️ Do not call synchronous Bukkit APIs such as `player.teleport()` inside filter functions
- ✅ Always remove the handler via `channel.eventLoop().execute()` to avoid pipeline race conditions
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| `NoSuchElementException: packet_handler` | The Netty pipeline handler name changed | Check `Connection.java` for the matching Paper version |
| Handler not triggered | Injected too late (packets already flowed through) | Use the `LOWEST` priority on `PlayerJoinEvent` |
| Handler causes lag | Blocking operations inside the filter function | Move blocking work to an async task; keep the filter to lightweight checks |
| `IllegalStateException: Handler already added` | Duplicate injection | Check before every inject: `pipeline().get(HANDLER_ID)` |
| `ClosedChannelException` on server shutdown | The pipeline is already closed during shutdown | Ignore the error, or uninject all players first in `onDisable` |
