---
id: nms-data-component
title: NMS Data Component
titleZh: NMS 物品組件系統
description: Read and write Minecraft 1.21 DataComponentType item components including CustomData, MaxStackSize, and Enchantments on Paper 1.21.x with Mojang mappings.
descriptionZh: 操作 Minecraft 1.21 DataComponentType 物品組件系統，讀寫 CustomData、MaxStackSize、Enchantments 等組件（Paper NMS + Mojang mappings）。
version: "1.0.0"
status: active
category: nms-data
categoryLabel: NMS 資料
categoryLabelEn: NMS Data
tags: [nms, data-component, item, customdata, enchantments, mojang-mapped]
triggerKeywords:
  - "DataComponent"
  - "data component"
  - "物品組件"
  - "1.21 item data"
  - "ItemStack component"
  - "DataComponentType"
  - "CustomData component"
  - "component map"
  - "DataComponents"
  - "組件讀寫"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-data-component/SKILL.md
featured: false
---

# NMS Data Component

## 目的

操作 Minecraft 1.21 引入的 `DataComponentType` 物品組件系統，直接讀寫 `CustomData`、`MaxStackSize`、`Enchantments`、`AttributeModifiers` 等組件，取代舊版 NBT `getTag()`/`setTag()` 模式。

---

## 平台需求

- Paper **1.21** – 1.21.3（DataComponent 為 1.20.5+ 新增）
- Paperweight userdev 2.0.0-beta.24+
- Mojang mappings（Paper 1.20.5+ 原生支援）
- Java 21

---

## 產生的代碼

### ItemComponentUtil.java

```java
// 讀取 MaxStackSize 組件
Optional<Integer> maxStack = ItemComponentUtil.get(item, DataComponents.MAX_STACK_SIZE);

// 設定 Unbreakable 組件（回傳新 ItemStack，原物不變）
ItemStack unbreakable = ItemComponentUtil.set(item, DataComponents.UNBREAKABLE,
    new Unbreakable(true));

// 移除組件
ItemStack clean = ItemComponentUtil.remove(item, DataComponents.CUSTOM_DATA);
```

### CustomDataHelper.java（自定義 NBT 組件）

```java
// 寫入自定義字串資料
ItemStack tagged = CustomDataHelper.setString(item, "rarity", "legendary");

// 讀取自定義整數資料
int level = CustomDataHelper.getInt(item, "weapon-level", 0);

// 檢查是否有指定鍵
boolean hasTag = CustomDataHelper.has(item, "owner-uuid");
```

---

## 執行緒安全

- `ItemComponentUtil` 操作 NMS Copy，可在任意執行緒呼叫
- 套用修改後的 ItemStack 至玩家物品欄須在主執行緒完成
