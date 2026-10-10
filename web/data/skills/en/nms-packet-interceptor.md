# NMS Packet Interceptor

## Purpose

Inject a custom `ChannelDuplexHandler` into the player's Netty connection pipeline to read, modify, or cancel packets as they enter or leave the server. Commonly used for anti-cheat, packet logging, and custom communication protocols.

---

## Alternatives

If you would rather not touch NMS / Netty, use the PacketEvents or ProtocolLib soft dependency instead: see `paper-packetevents-filter`. Either way, fail open: on error, let the packet pass through as usual, disable yourself, and log only once.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with trailing `// @1.21.11:` comments)
- Paperweight userdev 2.0.0-beta.24+
- Netty 4.x (bundled with Paper)

---

## Generated Code

### PacketInterceptor.java (ChannelDuplexHandler)

```java
public final class PacketInterceptor extends ChannelDuplexHandler {

    // Serverbound (client -> server)
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        if (msg instanceof Packet<?> packet) {
            Packet<?> modified = inboundFilter.apply(player, packet);
            if (modified == null) return; // cancel the packet
            msg = modified;
        }
        super.channelRead(ctx, msg);
    }

    // Clientbound (server -> client)
    @Override
    public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
        if (msg instanceof Packet<?> packet) {
            Packet<?> modified = outboundFilter.apply(player, packet);
            if (modified == null) return; // cancel the packet
            msg = modified;
        }
        super.write(ctx, msg, promise);
    }
}
```

### InterceptorManager.java

```java
// Inject (PlayerJoinEvent LOWEST)
channel.pipeline().addBefore("packet_handler", HANDLER_ID, interceptor);

// Remove (PlayerQuitEvent)
channel.eventLoop().execute(() -> channel.pipeline().remove(HANDLER_ID));
```

---

## Thread Safety

- `channelRead` / `write` both run on the Netty IO thread
- To access Entity/World, switch back to the main thread with `Bukkit.getScheduler().runTask()`
- Removing the handler must go through `channel.eventLoop().execute()`
