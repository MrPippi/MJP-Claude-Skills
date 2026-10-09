# NMS Network & Netty Pipeline 速查表 / NMS Network Reference

適用版本：Paper 1.21 – 1.21.3（Mojang mappings）
套件根：`net.minecraft.network`, `io.netty.channel`

> 封包攔截用法見 `Skills/nms/nms-packet-interceptor/SKILL.md`
> 執行緒規則見 `Skills/_shared/nms-threading.md`

---

## Channel Pipeline 結構

Paper 1.21 玩家連線的 Netty pipeline（從網路 wire 到 ServerPlayer）：

```
Network Wire (TCP)
       │
       ▼
┌──────────────────┐
│  frame_decoder   │  Varint 長度前綴拆幀（LengthFieldBasedFrameDecoder）
├──────────────────┤
│  prepender       │  (Outbound) 寫入 Varint 長度前綴
├──────────────────┤
│  decompress      │  Zlib 解壓縮（threshold 以上才啟用）
├──────────────────┤
│  compress        │  (Outbound) Zlib 壓縮
├──────────────────┤
│  decrypt         │  AES-CFB8 解密（登入後啟用）
├──────────────────┤
│  encrypt         │  (Outbound) AES-CFB8 加密
├──────────────────┤
│    decoder       │  封包 ID + FriendlyByteBuf → Packet<?> 物件
├──────────────────┤
│    encoder       │  (Outbound) Packet<?> 物件 → 位元組
├──────────────────┤
│  packet_handler  │  ServerGamePacketListenerImpl（vanilla 處理點）
└──────────────────┘
       │
       ▼
  ServerPlayer（Bukkit 事件從這裡觸發）
```

### 注入位置建議

```java
// 在 packet_handler 前注入，先於 vanilla 處理
channel.pipeline().addBefore("packet_handler", "my_handler", myHandler);
```

> ⚠️ 注意：`decoder` 之前注入的 handler 看到的是原始 byte，不是 Packet 物件。
> 若要讀取/修改 Packet 物件，務必加在 `decoder` 之後、`packet_handler` 之前。

---

## 執行緒模型圖 / Threading Model

```
Netty Boss Group    Netty Worker Group      Bukkit Main Thread
(accept 連線)       (IO 讀寫 / pipeline)     (tick 迴圈)
      │                    │                      │
      │   channel accept   │                      │
      ├──────────────────►│                      │
      │                    │  channelRead()        │
      │                    │  (所有 handler 的 read)│
      │                    │                      │
      │                    │  需要存取 Entity/World  │
      │                    │──────────────────────►│
      │                    │  Bukkit.getScheduler() │
      │                    │  .runTask()           │
      │                    │                      │
      │                    │  connection.send()    │
      │                    │◄──────────────────────│
      │                    │  (排入 Netty write queue)
      │                    │                      │
```

**核心規則**：

| 操作 | 執行緒 |
|------|-------|
| `channelRead()` handler | **Netty IO thread** |
| `write()` handler | **Netty IO thread** |
| `connection.send(packet)` | **Any**（Netty 排入 write queue） |
| `Bukkit.broadcastMessage()` | **Main thread only** |
| `player.teleport()` | **Main thread only** |
| `Level.getBlockState()` | **Main thread only** |

---

## Connection 類

`net.minecraft.network.Connection`

| 成員 | 類型 | 說明 |
|------|------|------|
| `channel` | `Channel` | 底層 Netty channel |
| `packetListener` | `PacketListener` | 當前協議階段的監聽器 |
| `address` | `SocketAddress` | 遠端 IP 位址 |
| `disconnected` | `boolean` | 連線是否已斷開 |

### 取得 Connection

```java
import net.minecraft.network.Connection;
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.craftbukkit.entity.CraftPlayer;

ServerPlayer nms = ((CraftPlayer) player).getHandle();
// nms.connection 是 ServerGamePacketListenerImpl
Connection connection = nms.connection.connection; // 底層 Connection 物件
Channel channel = connection.channel;
```

---

## ChannelDuplexHandler 生命週期

```java
import io.netty.channel.ChannelDuplexHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelPromise;

public class MyHandler extends ChannelDuplexHandler {

    /** 連線建立（通常在 pipeline 注入時已建立，不常用） */
    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        super.channelActive(ctx);
    }

    /** Serverbound：從 wire 讀入的封包（客戶端 → 伺服器）
     *  在 Netty IO thread 執行。
     *  呼叫 super.channelRead() 讓封包繼續往下傳。
     *  回傳 null 或不呼叫 super = 取消封包。 */
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        if (msg instanceof Packet<?> packet) {
            // 處理邏輯
        }
        super.channelRead(ctx, msg); // 繼續傳遞
    }

    /** Clientbound：準備寫出到 wire 的封包（伺服器 → 客戶端）
     *  在 Netty IO thread 執行。
     *  promise 為 ChannelFuture，可監聽寫入完成。 */
    @Override
    public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
        if (msg instanceof Packet<?> packet) {
            // 處理邏輯
        }
        super.write(ctx, msg, promise); // 繼續往 wire 送
    }

    /** 連線關閉（玩家離線或超時）
     *  在此清理資源，不要再呼叫 connection.send()。 */
    @Override
    public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        // 清理
        super.channelInactive(ctx);
    }

    /** 異常處理（DecoderException, ClosedChannelException 等） */
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        if (cause instanceof io.netty.handler.codec.DecoderException) {
            // 封包解析失敗，通常直接關閉連線
            ctx.close();
            return;
        }
        super.exceptionCaught(ctx, cause);
    }
}
```

---

## EventLoop 執行緒操作

移除 handler 必須在 EventLoop 上執行，避免 pipeline 競爭：

```java
import io.netty.channel.Channel;

// 安全移除 handler
Channel channel = connection.channel;
if (channel.isOpen()) {
    channel.eventLoop().execute(() -> {
        if (channel.pipeline().get("my_handler") != null) {
            channel.pipeline().remove("my_handler");
        }
    });
}
```

### EventLoop 常用方法

| 方法 | 說明 |
|------|------|
| `channel.eventLoop().execute(Runnable)` | 在 IO thread 執行一次 |
| `channel.eventLoop().inEventLoop()` | 檢查當前是否在 EventLoop |
| `channel.eventLoop().schedule(Runnable, delay, TimeUnit)` | 延遲執行 |
| `channel.isActive()` | 連線是否仍開啟 |
| `channel.isOpen()` | Channel 是否未關閉 |

---

## Pipeline 操作速查

```java
import io.netty.channel.ChannelPipeline;

ChannelPipeline pipeline = channel.pipeline();

// 插入 handler
pipeline.addBefore("packet_handler", "my_handler", handler); // 常用
pipeline.addAfter("decoder", "my_handler", handler);
pipeline.addFirst("my_handler", handler);
pipeline.addLast("my_handler", handler);

// 移除 handler
pipeline.remove("my_handler");
pipeline.remove(handler);

// 查詢 handler
ChannelHandler h = pipeline.get("my_handler");  // 不存在回傳 null
boolean exists = pipeline.get("my_handler") != null;

// 替換 handler
pipeline.replace("my_handler", "new_handler", newHandler);

// 列出所有 handler 名稱（除錯用）
pipeline.names().forEach(System.out::println);
```

---

## 常見 Netty 異常與處理

| 異常類 | 觸發時機 | 建議處理 |
|--------|---------|---------|
| `ClosedChannelException` | 向已關閉的 channel 寫入 | 在 send 前檢查 `channel.isActive()` |
| `DecoderException` | 封包格式錯誤（非法 VarInt 等） | 在 `exceptionCaught` 關閉連線 |
| `ReadTimeoutException` | 連線超時（KeepAlive 未收到） | Paper 自動處理，踢出玩家 |
| `IllegalStateException: Handler already added` | 重複注入同名 handler | 注入前先檢查 `pipeline.get(name) == null` |
| `NullPointerException: connection` | 玩家已離線 | 發送前檢查 `nms.connection != null` |

---

## ServerGamePacketListenerImpl 常用操作

`net.minecraft.server.network.ServerGamePacketListenerImpl`（即 `ServerPlayer.connection`）

```java
import net.minecraft.server.network.ServerGamePacketListenerImpl;

ServerGamePacketListenerImpl conn = nmsPlayer.connection;

// 發送封包
conn.send(packet);
conn.send(packet, PacketSendListener.thenRun(() -> {
    // 封包送達後的回調（在 IO thread）
}));

// 踢出玩家
conn.disconnect(Component.literal("你被踢出了"));

// 延遲踢出（在主執行緒）
Bukkit.getScheduler().runTask(plugin, () ->
    player.kick(net.kyori.adventure.text.Component.text("踢出原因")));
```

---

## Protocol 狀態枚舉

玩家連線在不同登入階段使用不同的封包協議：

| 階段 | 監聽器類 | 封包類型 |
|------|---------|---------|
| `HANDSHAKING` | 握手 | 僅 Handshake 封包 |
| `LOGIN` | `ServerLoginPacketListenerImpl` | Login 封包 |
| `PLAY` | `ServerGamePacketListenerImpl` | Game 封包 |
| `CONFIGURATION` | `ServerConfigurationPacketListenerImpl` | Config（1.20.2+）|

> Plugin 通常只接觸 PLAY 階段（`PlayerJoinEvent` 之後）。

---

## 相關技能

- `Skills/nms/nms-packet-interceptor/SKILL.md` — Netty pipeline 注入完整實作
- `Skills/nms/nms-packet-sender/SKILL.md` — 封包發送
- `Skills/_shared/nms-threading.md` — 執行緒安全詳解
- `docs/paper-nms/packets.md` — Clientbound/Serverbound 封包目錄
