---
id: nms-fake-player
title: NMS Fake Player
titleZh: NMS 假玩家
description: Client-less fake players (PvP bots, training dummies) backed by a real NMS ServerPlayer with vanilla combat and movement physics, confined NMS code and a version guard that disables only the bot feature.
descriptionZh: 以真正的 NMS ServerPlayer 建立沒有客戶端的假玩家（PvP 機器人、訓練假人）：原版戰鬥與移動物理、NMS 限定在單一套件、版本不符時只停用機器人功能。
version: "1.0.0"
status: active
category: nms-player
categoryLabel: NMS 玩家
categoryLabelEn: NMS Player
tags: [nms, fake-player, bot, serverplayer, npc, paperweight]
triggerKeywords:
  - "假玩家"
  - "fake player"
  - "PvP bot"
  - "機器人"
  - "訓練假人"
  - "ServerPlayer NPC"
updatedAt: "2026-10-09"
githubPath: Skills/nms/nms-fake-player/SKILL.md
featured: true
---

# NMS Fake Player

## 目的

建立「真的 `ServerPlayer`、但沒有客戶端」的假玩家。傷害、暴擊、擊退、舉盾、走路與跳台階都走原版邏輯，呼叫端只需每 tick 餵輸入與轉頭。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### FakePlayer.java（只在 `nms/` 套件）

```java
FakePlayer bot = FakePlayer.spawn(location, "Steve_Bot", challenger);
bot.clearSpawnInvulnerability();

// 每 tick（主執行緒）
bot.look(yaw, pitch);
bot.input(1f, 0f, false, true);   // 前進 + 疾跑
bot.attack(target);               // 原版近戰
bot.tick();
```

### BotService.java（Bukkit 端）

```java
public Optional<Player> spawn(Location at, String name, Player skinFrom) {
    if (!available) return Optional.empty();
    try {
        FakePlayer bot = FakePlayer.spawn(at, name, skinFrom);
        bots.add(bot);
        return Optional.of(bot.bukkit());
    } catch (LinkageError e) {   // Paper build 改了簽名：只停用 bot
        disable(e);
        return Optional.empty();
    }
}
```

---

## 關鍵做法

- `EmptyConnection`：丟掉送往假玩家的封包，只保留自己的擊退速度，下一 tick 套用
- 不走 `PlayerList` 登入流程：不觸發 `PlayerJoinEvent`、不在 tab 與 `getOnlinePlayers()`
- 生成前對所有人送玩家資訊（`listed=false`），新上線玩家補送
- 覆寫 `isClientAuthoritative()` 讓伺服器計算物理
- 建構與移除時拆掉成就監聽，避免記憶體洩漏

---

## 執行緒安全

- 所有操作只能在主執行緒；`tick()` 每個伺服器 tick 呼叫一次
