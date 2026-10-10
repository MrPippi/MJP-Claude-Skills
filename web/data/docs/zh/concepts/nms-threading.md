# NMS 執行緒安全模式 / NMS Threading Patterns

Paper NMS 開發的執行緒模型說明。所有 NMS 操作必須嚴格遵守執行緒邊界，否則會導致伺服器崩潰或數據損壞。

---

## 核心執行緒

| 執行緒 | 用途 | NMS 存取 |
|--------|------|----------|
| **Main（MinecraftServer thread）** | Tick 迴圈、實體更新、世界寫入 | ✅ 允許所有 NMS 存取 |
| **Netty IO threads** | 封包解碼/編碼 | ⚠️ 僅封包讀寫，禁止存取 `Level`/`Entity` |
| **Bukkit Async scheduler** | IO、DB、HTTP | ❌ 禁止直接存取 NMS |
| **Worldgen threads** | 世界生成 | ⚠️ 僅限生成相關 API |

---

## 檢查當前執行緒

```java
import net.minecraft.server.MinecraftServer;

// 檢查是否在主執行緒
if (!MinecraftServer.getServer().isSameThread()) {
    throw new IllegalStateException("Must be called from main thread");
}
```

---

## 模式 1：封包攔截（Netty → Main）

封包在 Netty IO 執行緒接收，若需修改實體狀態必須切回主執行緒。

```java
@Override
public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
    if (msg instanceof ServerboundChatPacket chat) {
        // Netty 執行緒：只做 packet 本身的解析
        String content = chat.message();

        // 需存取實體/世界 → 切回主執行緒
        Bukkit.getScheduler().runTask(plugin, () -> {
            player.sendMessage(Component.text("Echo: " + content));
        });
    }
    super.channelRead(ctx, msg);
}
```

---

## 模式 2：非同步 IO → NMS 操作

```java
CompletableFuture.supplyAsync(() -> database.fetchPlayerData(uuid))
    .thenAccept(data -> {
        // 回到主執行緒再存取 NMS
        Bukkit.getScheduler().runTask(plugin, () -> {
            ServerPlayer serverPlayer = ((CraftPlayer) player).getHandle();
            serverPlayer.connection.send(buildPacket(data));
        });
    });
```

---

## 模式 3：封包發送（可跨執行緒）

`ServerPlayer.connection.send()` 內部會將封包排入 Netty write queue，**可從任何執行緒呼叫**，但**封包內容建構**若依賴世界狀態，必須在主執行緒完成。

```java
// ✅ OK：封包在主執行緒建構，發送在任何執行緒
Bukkit.getScheduler().runTask(plugin, () -> {
    ClientboundSetTitleTextPacket packet = new ClientboundSetTitleTextPacket(
        Component.literal("Hello").getVisualOrderText()
    );
    CompletableFuture.runAsync(() -> serverPlayer.connection.send(packet));
});
```

---

## 模式 4：Tick 任務（NMS 原生）

繞過 Bukkit Scheduler，直接使用 NMS tick 佇列（更低延遲）。

```java
import net.minecraft.server.MinecraftServer;

MinecraftServer.getServer().execute(() -> {
    // 下一個 tick 在主執行緒執行
    level.broadcastEntityEvent(entity, (byte) 6);
});
```

---

## 常見錯誤

| 錯誤 | 症狀 | 修正 |
|------|------|------|
| Netty 執行緒呼叫 `Player.teleport()` | `ConcurrentModificationException` | 用 `Bukkit.getScheduler().runTask()` 切回主執行緒 |
| Async thread 存取 `Level.getChunk()` | Chunk 未載入或 race condition | 先在主執行緒讀取 chunk data，再傳給 async |
| 在 `channelRead` 內阻塞 | 所有該玩家的封包延遲 | Netty handler 內不可呼叫阻塞 IO |

---

## 相關技能

- `nms-packet-sender` — 封包發送不同執行緒的正確姿勢
- `nms-packet-interceptor` — Netty pipeline 注入與執行緒切換
