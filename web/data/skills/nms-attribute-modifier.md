---
id: nms-attribute-modifier
title: NMS Attribute Modifier
titleZh: NMS 屬性修改器
description: Dynamically modify entity attributes via NMS AttributeMap/AttributeModifier for RPG buff/debuff systems on Paper 1.21.x with Mojang mappings.
descriptionZh: 透過 NMS AttributeMap/AttributeModifier 動態修改實體屬性，實現 RPG 裝備加成與 Buff/Debuff 系統（Paper NMS + Mojang mappings）。
version: "1.0.0"
status: active
category: nms-entity
categoryLabel: NMS 實體
categoryLabelEn: NMS Entity
tags: [nms, attribute, modifier, rpg, buff, debuff, mojang-mapped]
triggerKeywords:
  - "attribute modifier"
  - "屬性修改"
  - "AttributeMap"
  - "動態屬性"
  - "entity attribute"
  - "MAX_HEALTH"
  - "ATTACK_DAMAGE"
  - "MOVEMENT_SPEED"
  - "屬性加成"
  - "Buff Debuff"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-attribute-modifier/SKILL.md
featured: false
---

# NMS Attribute Modifier

## 目的

透過 NMS `AttributeMap`、`AttributeInstance`、`AttributeModifier` 精確控制實體屬性，支援加法、倍乘、基底值修改，實現 RPG 裝備加成、Buff/Debuff 系統。

---

## 平台需求

- Paper 1.21 – 1.21.3
- Paperweight userdev 2.0.0-beta.24+
- Mojang mappings（Paper 1.20.5+ 原生支援）
- Java 21

---

## 產生的代碼

### AttributeUtil.java

```java
// 取得屬性最終值（含所有 modifier 計算後）
double hp = AttributeUtil.getValue(player, Attributes.MAX_HEALTH);

// 新增加法 modifier（+10 攻擊力）
AttributeUtil.addModifier(player, Attributes.ATTACK_DAMAGE,
    ModifierBuilder.additive("sword-bonus", 10.0));

// 移除指定 modifier
AttributeUtil.removeModifier(player, Attributes.ATTACK_DAMAGE, "sword-bonus");
```

### ModifierBuilder.java（建立器）

```java
// 加法（+value）
AttributeModifier mod = ModifierBuilder.additive("buff-id", 5.0);

// 倍乘基底（baseValue * value）
AttributeModifier mod = ModifierBuilder.multiplyBase("speed-boost", 0.2);

// 倍乘全部（finalValue * value）
AttributeModifier mod = ModifierBuilder.multiplyTotal("debuff", -0.1);
```

---

## 執行緒安全

- `AttributeUtil` 存取實體狀態，**必須在主執行緒呼叫**
