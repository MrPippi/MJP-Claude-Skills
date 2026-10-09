---
id: nms-boss-event
title: NMS Boss Event
titleZh: NMS Boss Bar 操作
description: Operate Boss Bar progress, color, style, and per-player visibility via NMS ServerBossEvent on Paper 26.x with official Mojang names.
descriptionZh: 透過 NMS ServerBossEvent 操作 Boss Bar 進度、顏色、風格與每人獨立可見性（Paper NMS + Mojang mappings）。
version: "1.0.0"
status: active
category: nms-display
categoryLabel: NMS 顯示
categoryLabelEn: NMS Display
tags: [nms, bossbar, boss-event, per-player, overlay, mojang-mapped]
triggerKeywords:
  - "boss bar"
  - "BossEvent"
  - "boss 進度條"
  - "NMS boss bar"
  - "ServerBossEvent"
  - "per-player boss bar"
  - "每人 boss bar"
  - "boss overlay"
  - "boss 顏色"
  - "boss 風格"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-boss-event/SKILL.md
featured: false
---

# NMS Boss Event

## 目的

透過 NMS `ServerBossEvent` 精確控制 Boss Bar 的進度、顏色、風格（分段線）、可見性，並實現每位玩家獨立的 Boss Bar 內容（Bukkit BossBar API 每個 Bar 對所有玩家相同）。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### NmsBossBar.java（單一 Boss Bar 封裝）

```java
// 建立帶分段的 Boss Bar
NmsBossBar bar = new NmsBossBar(
    "§c§lBoss §f— 100%",
    BossEvent.BossBarColor.RED,
    BossEvent.BossBarOverlay.NOTCHED_10
);

// 顯示給玩家
bar.addPlayer(player);

// 更新進度（0.0 ~ 1.0）
bar.setProgress(0.75f);

// 更新標題
bar.setTitle("§c§lBoss §f— 75%");
```

### BossBarManager.java（多玩家管理）

```java
// 建立每人獨立的 Boss Bar（各自顯示不同進度）
BossBarManager manager = new BossBarManager(plugin);
manager.getOrCreate(player, "§a任務進度", BossEvent.BossBarColor.GREEN, BossEvent.BossBarOverlay.PROGRESS);
manager.update(player, "§a任務進度 50%", 0.5f);
manager.remove(player);
manager.removeAll();  // Plugin disable 時呼叫
```

---

## 執行緒安全

- `ServerBossEvent.addPlayer()` / `removePlayer()` **必須在主執行緒呼叫**
- `setProgress()` / `setName()` 可在任意執行緒呼叫（封包自動排入 Netty write queue）
