---
id: nms-packet-interceptor
title: NMS Packet Interceptor
titleZh: NMS 封包攔截器
description: Inject a custom ChannelDuplexHandler into the Netty pipeline to intercept and modify Clientbound and Serverbound NMS packets.
descriptionZh: 透過 Netty ChannelDuplexHandler 注入玩家連線管線，攔截或修改 Clientbound 與 Serverbound 封包。
version: "1.0.0"
status: active
category: nms-packet
categoryLabel: NMS 封包
categoryLabelEn: NMS Packet
tags: [nms, packet, netty, interceptor, channel-handler, pipeline]
triggerKeywords:
  - "封包攔截"
  - "packet intercept"
  - "netty pipeline"
  - "channel handler"
  - "封包監聽"
  - "修改封包"
  - "packet listener"
updatedAt: "2026-04-19"
githubPath: Skills/nms/nms-packet-interceptor/SKILL.md
featured: true
---

# NMS Packet Interceptor

## 目的

在玩家的 Netty 連線管線中注入自訂 `ChannelDuplexHandler`，於封包進入或離開伺服器時進行讀取、修改或取消。常用於反外掛、封包記錄、自訂通訊協議。

---

## 平台需求

- Paper 1.21 – 1.21.3
- Paperweight userdev 2.0.0-beta.24+
- Netty 4.x（Paper 內建）

---

## 產生的代碼

### PacketInterceptor.java（ChannelDuplexHandler）

```java
public final class PacketInterceptor extends ChannelDuplexHandler {

    // Serverbound（客戶端 → 伺服器）
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        if (msg instanceof Packet<?> packet) {
            Packet<?> modified = inboundFilter.apply(player, packet);
            if (modified == null) return; // 取消封包
            msg = modified;
        }
        super.channelRead(ctx, msg);
    }

    // Clientbound（伺服器 → 客戶端）
    @Override
    public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
        if (msg instanceof Packet<?> packet) {
            Packet<?> modified = outboundFilter.apply(player, packet);
            if (modified == null) return; // 取消封包
            msg = modified;
        }
        super.write(ctx, msg, promise);
    }
}
```

### InterceptorManager.java

```java
// 注入（PlayerJoinEvent LOWEST）
channel.pipeline().addBefore("packet_handler", HANDLER_ID, interceptor);

// 移除（PlayerQuitEvent）
channel.eventLoop().execute(() -> channel.pipeline().remove(HANDLER_ID));
```

---

## 執行緒安全

- `channelRead` / `write` 皆在 Netty IO thread 執行
- 需存取 Entity/World → 用 `Bukkit.getScheduler().runTask()` 切回主執行緒
- 移除 handler 必須透過 `channel.eventLoop().execute()`
