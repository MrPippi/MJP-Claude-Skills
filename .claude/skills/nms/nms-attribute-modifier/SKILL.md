---
name: nms-attribute-modifier
description: "透過 NMS AttributeMap/AttributeModifier 動態修改實體屬性（MAX_HEALTH、ATTACK_DAMAGE 等），比 Bukkit API 更精確（Paper NMS + Mojang-mapped）/ Dynamically modify entity attributes via NMS AttributeMap/AttributeModifier"
---

# NMS Attribute Modifier / NMS 屬性修改器

## 技能名稱 / Skill Name

`nms-attribute-modifier`

## 目的 / Purpose

透過 NMS `AttributeMap`、`AttributeInstance`、`AttributeModifier` 精確控制實體屬性，支援加法、倍乘、基底值修改，實現 RPG 裝備加成、Buff/Debuff 系統。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21 – 1.21.3
- Paperweight userdev 1.7.2+
- Mojang mappings（已由 Paper 1.20.5+ 原生支援）

## 觸發條件 / Triggers

- 「attribute modifier」「屬性修改」「AttributeMap」「動態屬性」「entity attribute」
- 「MAX_HEALTH」「ATTACK_DAMAGE」「MOVEMENT_SPEED」「屬性加成」
- 「Buff Debuff」「nms attribute」「attribute instance」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.rpg` | 產出類別所在 package |
| `class_name` | `AttributeUtil` | 工具類名稱 |

## 輸出產物 / Outputs

- `AttributeUtil.java` — 屬性讀寫工具
- `ModifierBuilder.java` — AttributeModifier 建立器

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}
```

## 代碼範本 / Code Template

### `AttributeUtil.java`

```java
package com.example.rpg;

import net.minecraft.core.Holder;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.entity.ai.attributes.AttributeInstance;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import org.bukkit.craftbukkit.v1_21_R1.entity.CraftLivingEntity;
import org.bukkit.entity.LivingEntity;

import java.util.Optional;

@SuppressWarnings("UnstableApiUsage")
public final class AttributeUtil {

    private AttributeUtil() {}

    /** 取得屬性實例（若實體不支援該屬性則回傳 empty）。 */
    public static Optional<AttributeInstance> getInstance(
            LivingEntity entity, Holder<Attribute> attribute) {
        net.minecraft.world.entity.LivingEntity nms = ((CraftLivingEntity) entity).getHandle();
        return Optional.ofNullable(nms.getAttribute(attribute));
    }

    /** 讀取屬性最終值（含所有 modifier 計算後）。 */
    public static double getValue(LivingEntity entity, Holder<Attribute> attribute) {
        return getInstance(entity, attribute)
            .map(AttributeInstance::getValue)
            .orElse(0.0);
    }

    /** 讀取屬性基底值（不含 modifier）。 */
    public static double getBaseValue(LivingEntity entity, Holder<Attribute> attribute) {
        return getInstance(entity, attribute)
            .map(AttributeInstance::getBaseValue)
            .orElse(0.0);
    }

    /** 設定屬性基底值。 */
    public static void setBaseValue(LivingEntity entity, Holder<Attribute> attribute, double value) {
        getInstance(entity, attribute).ifPresent(inst -> inst.setBaseValue(value));
    }

    /** 新增 AttributeModifier（若相同 id 已存在會先移除）。 */
    public static void addModifier(LivingEntity entity, Holder<Attribute> attribute,
                                   AttributeModifier modifier) {
        getInstance(entity, attribute).ifPresent(inst -> {
            inst.removeModifier(modifier.id());
            inst.addPermanentModifier(modifier);
        });
    }

    /** 移除指定 id 的 AttributeModifier。 */
    public static void removeModifier(LivingEntity entity, Holder<Attribute> attribute,
                                      java.util.UUID id) {
        getInstance(entity, attribute).ifPresent(inst -> inst.removeModifier(id));
    }

    /** 移除指定 id 的 AttributeModifier（ResourceLocation 版）。 */
    public static void removeModifier(LivingEntity entity, Holder<Attribute> attribute,
                                      net.minecraft.resources.ResourceLocation id) {
        getInstance(entity, attribute).ifPresent(inst -> inst.removeModifier(id));
    }

    /** 移除全部 modifier（僅保留基底值）。 */
    public static void clearModifiers(LivingEntity entity, Holder<Attribute> attribute) {
        getInstance(entity, attribute).ifPresent(inst ->
            inst.getModifiers().forEach(m -> inst.removeModifier(m.id())));
    }

    // ─── 常用屬性常數快捷 ───────────────────────────────────────────

    public static double getMaxHealth(LivingEntity e) { return getValue(e, Attributes.MAX_HEALTH); }
    public static void setMaxHealth(LivingEntity e, double v) { setBaseValue(e, Attributes.MAX_HEALTH, v); }

    public static double getAttackDamage(LivingEntity e) { return getValue(e, Attributes.ATTACK_DAMAGE); }
    public static void setAttackDamage(LivingEntity e, double v) { setBaseValue(e, Attributes.ATTACK_DAMAGE, v); }

    public static double getMovementSpeed(LivingEntity e) { return getValue(e, Attributes.MOVEMENT_SPEED); }
    public static void setMovementSpeed(LivingEntity e, double v) { setBaseValue(e, Attributes.MOVEMENT_SPEED, v); }
}
```

### `ModifierBuilder.java`

```java
package com.example.rpg;

import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;

/**
 * AttributeModifier 建立器。
 *
 * Operation 說明：
 *  ADDITION        — 加法：baseValue + amount
 *  MULTIPLY_BASE   — 乘基底：baseValue + baseValue * amount
 *  MULTIPLY_TOTAL  — 乘總值：totalValue * (1 + amount)
 */
public final class ModifierBuilder {

    private ModifierBuilder() {}

    /** 建立加法 modifier（e.g. +5 攻擊力）。 */
    public static AttributeModifier addition(String namespace, String path, double amount) {
        return new AttributeModifier(
            ResourceLocation.fromNamespaceAndPath(namespace, path),
            amount,
            AttributeModifier.Operation.ADD_VALUE
        );
    }

    /** 建立乘基底 modifier（e.g. +10% 攻擊力）。 */
    public static AttributeModifier multiplyBase(String namespace, String path, double multiplier) {
        return new AttributeModifier(
            ResourceLocation.fromNamespaceAndPath(namespace, path),
            multiplier,
            AttributeModifier.Operation.ADD_MULTIPLIED_BASE
        );
    }

    /** 建立乘總值 modifier（e.g. 全部計算後再 ×1.1）。 */
    public static AttributeModifier multiplyTotal(String namespace, String path, double multiplier) {
        return new AttributeModifier(
            ResourceLocation.fromNamespaceAndPath(namespace, path),
            multiplier,
            AttributeModifier.Operation.ADD_MULTIPLIED_TOTAL
        );
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── rpg/
    ├── AttributeUtil.java
    └── ModifierBuilder.java
```

## 執行緒安全注意事項 / Thread Safety

- ⚠️ `AttributeInstance` 操作**必須在主執行緒呼叫**（NMS 實體狀態非執行緒安全）
- ✅ `ModifierBuilder` 的方法為純資料建立，可在任意執行緒呼叫
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `getInstance` 回傳 empty | 實體不支援該屬性 | 確認 EntityType 支援（如 Slime 無 ATTACK_DAMAGE） |
| modifier 無效果 | Operation 選擇錯誤 | 參考 Operation 說明選擇正確計算方式 |
| 屬性值被重置 | 實體死亡/重生後 modifier 消失 | 在 EntitySpawnEvent 重新套用 modifier |
| `addModifier` 拋 IllegalArgumentException | 相同 ResourceLocation 已存在 | 呼叫前先 `removeModifier()` |
