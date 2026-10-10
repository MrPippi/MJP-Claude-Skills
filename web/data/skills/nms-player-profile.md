---
id: nms-player-profile
title: NMS Player Profile
titleZh: NMS 玩家 Profile 操作
description: Manipulate GameProfile for skin injection used in NPC appearance and fake player entities on Paper 26.x with official Mojang names.
descriptionZh: 操作 GameProfile 進行 skin 注入，用於 NPC 外觀設定與假玩家實體。
version: "1.0.0"
status: active
category: nms-player
categoryLabel: NMS 玩家
categoryLabelEn: NMS Player
tags: [nms, gameprofile, skin, npc, texture, mojang-mapped]
triggerKeywords:
  - "GameProfile"
  - "skin injection"
  - "NPC 皮膚"
  - "player profile"
  - "skin NPC"
  - "fake player"
  - "假玩家"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-player-profile/SKILL.md
featured: false
---

# NMS Player Profile

## 目的

透過 NMS `GameProfile` 操作玩家皮膚（texture）屬性，實現 NPC 外觀注入、假玩家實體皮膚設定，以及客製化頭顱 skull 顯示。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### ProfileBuilder.java

```java
// 從現有玩家複製 profile
GameProfile profile = ProfileBuilder.copyFrom(player);

// 以 Base64 texture 建立自定義 profile
GameProfile custom = ProfileBuilder.withSkin("NpcName", textureValue, signature);
```

### SkinFetcher.java（非同步抓取）

```java
SkinFetcher.fetchByName(plugin, "Notch").thenAccept(profile -> {
    Bukkit.getScheduler().runTask(plugin, () -> spawnNpc(location, profile));
});
```

---

## 執行緒安全

- `ProfileBuilder` 純資料操作，可在任意執行緒呼叫
- skin 抓取後需切回主執行緒套用到 NPC 實體
