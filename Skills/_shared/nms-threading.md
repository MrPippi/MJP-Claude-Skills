# NMS Threading Patterns / NMS 執行緒安全模式

Explains the threading model for Paper NMS development. All NMS operations must strictly respect thread boundaries, otherwise the server may crash or data may be corrupted.

---

## Core Threads

| Thread | Purpose | NMS access |
|--------|------|----------|
| **Main (MinecraftServer thread)** | Tick loop, entity updates, world writes | ✅ All NMS access allowed |
| **Netty IO threads** | Packet decode/encode | ⚠️ Packet read/write only; do not access `Level`/`Entity` |
| **Bukkit Async scheduler** | IO, DB, HTTP | ❌ Direct NMS access forbidden |
| **Worldgen threads** | World generation | ⚠️ Generation-related APIs only |

---

## Checking the Current Thread

```java
import net.minecraft.server.MinecraftServer;

// Check whether on the main thread
if (!MinecraftServer.getServer().isSameThread()) {
    throw new IllegalStateException("Must be called from main thread");
}
```

---

## Pattern 1: Packet Interception (Netty → Main)

Packets are received on a Netty IO thread; to modify entity state you must switch back to the main thread.

```java
@Override
public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
    if (msg instanceof ServerboundChatPacket chat) {
        // Netty thread: only parse the packet itself
        String content = chat.message();

        // Entity/world access needed -> switch back to the main thread
        Bukkit.getScheduler().runTask(plugin, () -> {
            player.sendMessage(Component.text("Echo: " + content));
        });
    }
    super.channelRead(ctx, msg);
}
```

---

## Pattern 2: Async IO → NMS Operations

```java
CompletableFuture.supplyAsync(() -> database.fetchPlayerData(uuid))
    .thenAccept(data -> {
        // Return to the main thread before accessing NMS
        Bukkit.getScheduler().runTask(plugin, () -> {
            ServerPlayer serverPlayer = ((CraftPlayer) player).getHandle();
            serverPlayer.connection.send(buildPacket(data));
        });
    });
```

---

## Pattern 3: Sending Packets (cross-thread allowed)

`ServerPlayer.connection.send()` queues the packet into the Netty write queue internally, so it **can be called from any thread**. However, if **building the packet contents** depends on world state, that must be done on the main thread.

```java
// ✅ OK: packet built on the main thread, sent from any thread
Bukkit.getScheduler().runTask(plugin, () -> {
    ClientboundSetTitleTextPacket packet = new ClientboundSetTitleTextPacket(
        Component.literal("Hello").getVisualOrderText()
    );
    CompletableFuture.runAsync(() -> serverPlayer.connection.send(packet));
});
```

---

## Pattern 4: Tick Tasks (NMS native)

Bypass the Bukkit Scheduler and use the NMS tick queue directly (lower latency).

```java
import net.minecraft.server.MinecraftServer;

MinecraftServer.getServer().execute(() -> {
    // Runs on the main thread on the next tick
    level.broadcastEntityEvent(entity, (byte) 6);
});
```

---

## Common Mistakes

| Mistake | Symptom | Fix |
|------|------|------|
| Calling `Player.teleport()` from a Netty thread | `ConcurrentModificationException` | Switch back to the main thread with `Bukkit.getScheduler().runTask()` |
| Accessing `Level.getChunk()` from an async thread | Chunk not loaded or race condition | Read the chunk data on the main thread first, then pass it to async |
| Blocking inside `channelRead` | All of that player's packets are delayed | Never call blocking IO inside a Netty handler |

---

## Related Skills

- `nms-packet-sender` — the right way to send packets across threads
- `nms-packet-interceptor` — Netty pipeline injection and thread switching
