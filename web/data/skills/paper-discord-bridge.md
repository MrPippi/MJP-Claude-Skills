---
id: paper-discord-bridge
title: Paper Discord Bridge
titleZh: Discord 橋接
description: JDK-only two-way Discord chat bridge for Paper - outbound webhook queue with 429 retry, no mentions and markdown escaping, inbound Gateway WebSocket state machine on one thread hopping to the main thread, secrets never logged.
descriptionZh: 只用 JDK 的 Discord 聊天橋接（不需 JDA／DiscordSRV）：遊戲到 Discord 走 webhook 佇列（429 重送、禁止提及、Markdown 跳脫），Discord 到遊戲走 Gateway WebSocket 狀態機（單一執行緒、切回主執行緒），祕密不進 log。
version: "1.0.0"
status: active
category: paper-integration
categoryLabel: Paper 整合
categoryLabelEn: Paper Integration
tags: [paper-api, discord, webhook, gateway, websocket, chat-bridge]
triggerKeywords:
  - "Discord 橋接"
  - "Discord bridge"
  - "Discord 聊天同步"
  - "聊天互通"
  - "two-way chat"
  - "Discord webhook"
  - "Discord Gateway"
  - "Discord bot"
  - "不用 JDA"
  - "without JDA"
  - "不用 DiscordSRV"
  - "死亡訊息送 Discord"
  - "announce to Discord"
updatedAt: "2026-10-11"
githubPath: Skills/paper/paper-discord-bridge/SKILL.md
featured: false
---

# Paper Discord Bridge

## 目的

只用 JDK（`java.net.http.HttpClient`／`WebSocket`）與 paper-api 附帶的 Gson，把遊戲聊天和**一個 Discord 頻道**互通；不用 JDA、不用 DiscordSRV，也不 shade 任何東西。兩個層級，挑最小的能用的：

| 層級 | 方向 | Discord 端需求 | 插件內執行 |
|------|------|----------------|-----------|
| 1. 只用 webhook | 遊戲 → Discord | 頻道 webhook URL（不需 bot） | `PostQueue`（一條 daemon 執行緒） |
| 2. 雙向 | 遊戲 ↔ Discord | 層級 1 加 bot：token、開啟 Message Content Intent、頻道權限、頻道 ID | `PostQueue` + `GatewayClient`（一條排程執行緒） |

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版相同；用 `AsyncChatEvent`、Adventure、Bukkit 排程器）
- 純 Paper API，不需要 Paperweight；`java.net.http` 屬 JDK、Gson 隨 paper-api 提供，不需額外依賴
- Discord API v10，Gateway `encoding=json`（不壓縮）

---

## 產生的代碼

### 核心（無 Bukkit，可 JUnit）

`Backoff`（重連退避＋抖動）、`Payloads`（外送 JSON 與跳脫）、`InboundText`（MESSAGE_CREATE 過濾與清理）、`GatewaySession`（Gateway 協定狀態機）。

### Payloads.java（外送：禁止提及、跳脫 Markdown）

```java
private static JsonObject base(String content) {
    JsonObject mentions = new JsonObject();
    mentions.add("parse", new JsonArray());            // 任何文字都不能 ping 人／身分組／@everyone
    JsonObject body = new JsonObject();
    body.addProperty("content", clip(content));
    body.addProperty("flags", SUPPRESS_EMBEDS);        // 連結不展開
    body.add("allowed_mentions", mentions);
    return body;
}
```

### InboundText.java（外來訊息過濾，防回音）

```java
if (!channelId.equals(string(d, "channel_id")) || author == null || messageId == null
        || bool(author, "bot") || present(d, "webhook_id") || !acceptedType(d)) {
    return Optional.empty();   // 含自己送出的 webhook 訊息（回音迴圈防護）
}
```

### PostQueue.java（Discord I/O：單執行緒有序外送）

呼叫端只 `enqueue`、不等 HTTP。工作執行緒依序送出；遇 429 睡 `Retry-After`（有上限）後只重送一次；其他失敗只記一行節流 WARNING，且只含狀態碼。

### GatewayClient.java（WebSocket 驅動）

HELLO → 帶抖動的心跳 → IDENTIFY／RESUME → READY／RESUMED；處理 opcode 1/7/9/11、`resume_gateway_url`、殭屍連線偵測、不得重連的關閉碼、指數退避。

### InboundRelay.java（主執行緒：綁定檢查 → 送入遊戲或回覆）

```java
// AccountLinks 決定誰能在遊戲內發言；ChatSink 負責送達
// 預設用 Adventure + MiniMessage Placeholder.unparsed，Discord 文字無法注入標籤
```

其餘：`BridgeConfig`（不可變，`toString` 遮蔽祕密）、`AccountLinks`、`ChatSink`、`DiscordBridgePlugin`（組裝）、`GatewaySessionTest`、`TextRulesTest`、`config.yml`、`plugin.yml`。

---

## 規則

- 外送一律經 `Payloads` 建 body：永遠帶 `allowed_mentions.parse = []`；回覆另設 `replied_user: false`
- `escapeMarkdown` 也跳脫 `<`，`<@id>`、`<#id>`、`<t:…>` 不會被渲染成提及；webhook 名稱的 `clyde`／`discord` 以零寬空格拆開
- 外來文字清掉 U+00A7 色碼、控制字元、雙向／零寬格式字元，換行壓成空白，超長以 `…` 截斷
- 忽略 `webhook_id`、`author.bot` 與非一般／回覆類型的訊息（回音迴圈防護）
- 不跟隨重新導向（避免 `Authorization` 標頭被帶到別的主機）
- 伺服器已跑 DiscordSRV 時不要再建第二條連線，改用 `paper-softdepend-hook` 掛接
- 範本只依賴 Paper API，不得出現 `net.minecraft` / `org.bukkit.craftbukkit`

---

## 執行緒安全

| 程式碼 | 執行緒 | 規則 |
|--------|--------|------|
| `onChat(AsyncChatEvent)` | 非同步聊天執行緒 | 只讀事件後 `PostQueue#enqueue`（非阻塞） |
| `PostQueue` 工作者 | 自己的 daemon 執行緒 | 唯一會阻塞 HTTP／睡 `Retry-After` 的地方 |
| `GatewaySession`、`GatewayClient` 全部狀態 | 單一 `DiscordBridge-Gateway` 執行緒 | WebSocket 回呼只 `post` 進來；此處不碰 Bukkit |
| `InboundRelay`、`AccountLinks`、`ChatSink` | **主執行緒**（`runTask`） | 可呼叫 Bukkit API |
| `onDisable` | 主執行緒 | 佇列丟棄積壓、Gateway 送 close 1000；總等待有上限 |

- 不要在 `GatewayClient` 的 consumer 內呼叫 `Bukkit.broadcast`、`getPlayer`；先切回主執行緒
- `runTask` 在插件停用中會丟 `IllegalPluginAccessException`，`runOnMain` 先檢查 `isEnabled()` 並攔截
- 不要把單一 Gateway 執行緒換成執行緒池：心跳要帶最新序號，舊 socket 的遲到 close 不能再觸發第二次重連

---

## 注意事項

- 祕密不進 log：bot token 與 webhook URL 不寫入 console、例外訊息或狀態；`BridgeConfig#toString` 顯示 `***`；HTTP 失敗只記狀態碼或例外類名
- `allow-unlinked: true` 時遊戲內名稱就是任何人都能自選的 Discord 顯示名：`format` 要保留 `[Discord]` 標記，或改用真正的綁定查詢並顯示 Minecraft 名稱
- 常見錯誤：`4014` 未開 Message Content Intent；`4004` token 錯誤（致命碼不重試）；回覆 403 代表 bot 缺頻道權限；聊天 404 代表 webhook 已刪
- 佇列滿代表 Discord 長時間無法連線：遊戲不受影響，新訊息被丟棄並自行恢復
- 訊息在遊戲內出現兩次通常是同一頻道有兩個橋接（例如 DiscordSRV）
