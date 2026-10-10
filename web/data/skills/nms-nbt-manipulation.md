---
id: nms-nbt-manipulation
title: NMS NBT Manipulation
titleZh: NMS NBT 操作
description: Read and write NBT data on items, entities, and block entities via CompoundTag on Paper 26.x with official Mojang names.
descriptionZh: 直接操作 CompoundTag 讀寫物品、實體、方塊實體的 NBT 資料。
version: "1.0.0"
status: active
category: nms-data
categoryLabel: NMS 資料
categoryLabelEn: NMS Data
tags: [nms, nbt, compound-tag, persistence, item, entity, mojang-mapped]
triggerKeywords:
  - "NBT"
  - "CompoundTag"
  - "NBT 讀寫"
  - "物品 NBT"
  - "實體 NBT"
  - "nbt manipulation"
  - "nbt persistence"
  - "持久化"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-nbt-manipulation/SKILL.md
featured: true
---

# NMS NBT Manipulation

## 目的

透過 NMS `CompoundTag` 直接讀寫物品、實體、方塊實體的 NBT 資料，繞過 Bukkit PersistentDataContainer API 的限制，實現底層持久化與資料操作。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### ItemNbtHelper.java

```java
// 讀取字串 NBT
Optional<String> getString(ItemStack item, String key)

// 寫入字串 NBT（回傳不可變副本）
ItemStack setString(ItemStack item, String key, String value)

// 讀取整數 NBT
int getInt(ItemStack item, String key, int def)

// 寫入整數 NBT
ItemStack setInt(ItemStack item, String key, int value)
```

### EntityNbtHelper.java

```java
// 讀取實體完整 CompoundTag
CompoundTag getTag(Entity entity)

// 合併 patch 到實體 NBT
void mergeTag(Entity entity, CompoundTag patch)
```

---

## 執行緒安全

- `ItemNbtHelper` 操作 NMS Copy，可在任意執行緒呼叫
- `EntityNbtHelper` 存取實體狀態，**必須在主執行緒呼叫**
