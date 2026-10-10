# NMS Network & Netty Pipeline Reference

Applicable versions: Paper 1.21.11 / 26.2 (Mojang official names; vanilla is no longer obfuscated since 26.1). Where the two versions differ, the code is marked with an end-of-line `// @1.21.11:` comment or a `// @only <version>` block.
Package roots: `net.minecraft.network`, `io.netty.channel`

> For packet interception usage, see `Skills/nms/nms-packet-interceptor/SKILL.md`
> For threading rules, see `Skills/_shared/nms-threading.md`

---

## Channel Pipeline Structure

The Netty pipeline of a player connection on Paper 26.x (from the network wire to ServerPlayer):

```
Network Wire (TCP)
       │
       ▼
┌──────────────────┐
│  frame_decoder   │  Varint length-prefix framing (LengthFieldBasedFrameDecoder)
├──────────────────┤
│  prepender       │  (Outbound) Writes the Varint length prefix
├──────────────────┤
│  decompress      │  Zlib decompression (enabled only above the threshold)
├──────────────────┤
│  compress        │  (Outbound) Zlib compression
├──────────────────┤
│  decrypt         │  AES-CFB8 decryption (enabled after login)
├──────────────────┤
│  encrypt         │  (Outbound) AES-CFB8 encryption
├──────────────────┤
│    decoder       │  Packet ID + FriendlyByteBuf → Packet<?> object
├──────────────────┤
│    encoder       │  (Outbound) Packet<?> object → bytes
├──────────────────┤
│  packet_handler  │  ServerGamePacketListenerImpl (vanilla handling point)
└──────────────────┘
       │
       ▼
  ServerPlayer (Bukkit events are fired from here)
```

### Recommended Injection Point

```java
// Inject before packet_handler, ahead of vanilla handling
channel.pipeline().addBefore("packet_handler", "my_handler", myHandler);
```

> ⚠️ Note: handlers injected before `decoder` see raw bytes, not Packet objects.
> To read/modify Packet objects, always add the handler after `decoder` and before `packet_handler`.

---

## Threading Model

```
Netty Boss Group    Netty Worker Group      Bukkit Main Thread
(accepts connections) (IO read/write / pipeline) (tick loop)
      │                    │                      │
      │   channel accept   │                      │
      ├──────────────────►│                      │
      │                    │  channelRead()        │
      │                    │  (read of all handlers)│
      │                    │                      │
      │                    │  needs Entity/World access │
      │                    │──────────────────────►│
      │                    │  Bukkit.getScheduler() │
      │                    │  .runTask()           │
      │                    │                      │
      │                    │  connection.send()    │
      │                    │◄──────────────────────│
      │                    │  (queued to the Netty write queue)
      │                    │                      │
```

**Core rules**:

| Operation | Thread |
|------|-------|
| `channelRead()` handler | **Netty IO thread** |
| `write()` handler | **Netty IO thread** |
| `connection.send(packet)` | **Any** (Netty queues it to the write queue) |
| `Bukkit.broadcastMessage()` | **Main thread only** |
| `player.teleport()` | **Main thread only** |
| `Level.getBlockState()` | **Main thread only** |

---

## Connection Class

`net.minecraft.network.Connection`

| Member | Type | Description |
|------|------|------|
| `channel` | `Channel` | Underlying Netty channel |
| `packetListener` | `PacketListener` | Listener for the current protocol phase |
| `address` | `SocketAddress` | Remote IP address |
| `disconnected` | `boolean` | Whether the connection has been closed |

### Getting the Connection

```java
import net.minecraft.network.Connection;
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.craftbukkit.entity.CraftPlayer;

ServerPlayer nms = ((CraftPlayer) player).getHandle();
// nms.connection is a ServerGamePacketListenerImpl
Connection connection = nms.connection.connection; // Underlying Connection object
Channel channel = connection.channel;
```

---

## ChannelDuplexHandler Lifecycle

```java
import io.netty.channel.ChannelDuplexHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelPromise;

public class MyHandler extends ChannelDuplexHandler {

    /** Connection established (usually already established when injected into the pipeline; rarely used) */
    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        super.channelActive(ctx);
    }

    /** Serverbound: packets read from the wire (client → server).
     *  Runs on the Netty IO thread.
     *  Call super.channelRead() to pass the packet along.
     *  Returning null or not calling super = cancel the packet. */
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        if (msg instanceof Packet<?> packet) {
            // Handling logic
        }
        super.channelRead(ctx, msg); // Continue passing it along
    }

    /** Clientbound: packets about to be written to the wire (server → client).
     *  Runs on the Netty IO thread.
     *  promise is a ChannelFuture; you can listen for write completion. */
    @Override
    public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
        if (msg instanceof Packet<?> packet) {
            // Handling logic
        }
        super.write(ctx, msg, promise); // Continue sending to the wire
    }

    /** Connection closed (player left or timed out).
     *  Clean up resources here; do not call connection.send() again. */
    @Override
    public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        // Clean up
        super.channelInactive(ctx);
    }

    /** Exception handling (DecoderException, ClosedChannelException, etc.) */
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        if (cause instanceof io.netty.handler.codec.DecoderException) {
            // Packet parsing failed; usually just close the connection
            ctx.close();
            return;
        }
        super.exceptionCaught(ctx, cause);
    }
}
```

---

## EventLoop Thread Operations

Removing a handler must run on the EventLoop to avoid pipeline races:

```java
import io.netty.channel.Channel;

// Safely remove a handler
Channel channel = connection.channel;
if (channel.isOpen()) {
    channel.eventLoop().execute(() -> {
        if (channel.pipeline().get("my_handler") != null) {
            channel.pipeline().remove("my_handler");
        }
    });
}
```

### Common EventLoop Methods

| Method | Description |
|------|------|
| `channel.eventLoop().execute(Runnable)` | Run once on the IO thread |
| `channel.eventLoop().inEventLoop()` | Check whether the current thread is in the EventLoop |
| `channel.eventLoop().schedule(Runnable, delay, TimeUnit)` | Delayed execution |
| `channel.isActive()` | Whether the connection is still open |
| `channel.isOpen()` | Whether the Channel is not closed |

---

## Pipeline Operations Cheat Sheet

```java
import io.netty.channel.ChannelPipeline;

ChannelPipeline pipeline = channel.pipeline();

// Insert a handler
pipeline.addBefore("packet_handler", "my_handler", handler); // Most common
pipeline.addAfter("decoder", "my_handler", handler);
pipeline.addFirst("my_handler", handler);
pipeline.addLast("my_handler", handler);

// Remove a handler
pipeline.remove("my_handler");
pipeline.remove(handler);

// Look up a handler
ChannelHandler h = pipeline.get("my_handler");  // Returns null if absent
boolean exists = pipeline.get("my_handler") != null;

// Replace a handler
pipeline.replace("my_handler", "new_handler", newHandler);

// List all handler names (for debugging)
pipeline.names().forEach(System.out::println);
```

---

## Common Netty Exceptions and Handling

| Exception class | When it occurs | Recommended handling |
|--------|---------|---------|
| `ClosedChannelException` | Writing to a closed channel | Check `channel.isActive()` before sending |
| `DecoderException` | Malformed packet (illegal VarInt, etc.) | Close the connection in `exceptionCaught` |
| `ReadTimeoutException` | Connection timed out (KeepAlive not received) | Handled automatically by Paper, which kicks the player |
| `IllegalStateException: Handler already added` | Injecting a handler with the same name twice | Check `pipeline.get(name) == null` before injecting |
| `NullPointerException: connection` | Player has already left | Check `nms.connection != null` before sending |

---

## ServerGamePacketListenerImpl Common Operations

`net.minecraft.server.network.ServerGamePacketListenerImpl` (i.e. `ServerPlayer.connection`)

```java
import net.minecraft.server.network.ServerGamePacketListenerImpl;

ServerGamePacketListenerImpl conn = nmsPlayer.connection;

// Send a packet
conn.send(packet);
conn.send(packet, PacketSendListener.thenRun(() -> {
    // Callback after the packet is delivered (on the IO thread)
}));

// Kick the player
conn.disconnect(Component.literal("You were kicked"));

// Delayed kick (on the main thread)
Bukkit.getScheduler().runTask(plugin, () ->
    player.kick(net.kyori.adventure.text.Component.text("Kick reason")));
```

---

## Protocol State Enum

A player connection uses a different packet protocol in each login phase:

| Phase | Listener class | Packet types |
|------|---------|---------|
| `HANDSHAKING` | Handshake | Handshake packets only |
| `LOGIN` | `ServerLoginPacketListenerImpl` | Login packets |
| `PLAY` | `ServerGamePacketListenerImpl` | Game packets |
| `CONFIGURATION` | `ServerConfigurationPacketListenerImpl` | Config (1.20.2+) |

> Plugins usually only deal with the PLAY phase (after `PlayerJoinEvent`).

---

## Related Skills

- `Skills/nms/nms-packet-interceptor/SKILL.md` — Full Netty pipeline injection implementation
- `Skills/nms/nms-packet-sender/SKILL.md` — Packet sending
- `Skills/_shared/nms-threading.md` — Thread safety in detail
- `docs/paper-nms/packets.md` — Clientbound/Serverbound packet catalog
