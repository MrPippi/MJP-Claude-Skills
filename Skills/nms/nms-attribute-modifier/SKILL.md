---
name: nms-attribute-modifier
description: "透過 NMS AttributeMap/AttributeModifier 動態修改實體屬性（MAX_HEALTH、ATTACK_DAMAGE 等），比 Bukkit API 更精確（Paper NMS + Mojang-mapped）/ Dynamically modify entity attributes via NMS AttributeMap/AttributeModifier"
---

# NMS Attribute Modifier

## Skill Name

`nms-attribute-modifier`

## Purpose

Precisely control entity attributes through NMS `AttributeMap`, `AttributeInstance`, and `AttributeModifier`. Supports additive and multiplicative modifiers and base value changes, enabling RPG equipment bonuses and Buff/Debuff systems.

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- 「attribute modifier」「屬性修改」「AttributeMap」「動態屬性」「entity attribute」
- 「MAX_HEALTH」「ATTACK_DAMAGE」「MOVEMENT_SPEED」「屬性加成」
- 「Buff Debuff」「nms attribute」「attribute instance」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.rpg` | Package for the generated classes |
| `class_name` | `AttributeUtil` | Utility class name |

## Outputs

- `AttributeUtil.java` — attribute read/write utility
- `ModifierBuilder.java` — AttributeModifier builder

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `AttributeUtil.java`

```java
package com.example.rpg;

import net.minecraft.core.Holder;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.entity.ai.attributes.AttributeInstance;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import org.bukkit.craftbukkit.entity.CraftLivingEntity;
import org.bukkit.entity.LivingEntity;

import java.util.Optional;

@SuppressWarnings("UnstableApiUsage")
public final class AttributeUtil {

    private AttributeUtil() {}

    /** Gets the attribute instance (returns empty if the entity does not support the attribute). */
    public static Optional<AttributeInstance> getInstance(
            LivingEntity entity, Holder<Attribute> attribute) {
        net.minecraft.world.entity.LivingEntity nms = ((CraftLivingEntity) entity).getHandle();
        return Optional.ofNullable(nms.getAttribute(attribute));
    }

    /** Reads the final attribute value (after all modifiers are applied). */
    public static double getValue(LivingEntity entity, Holder<Attribute> attribute) {
        return getInstance(entity, attribute)
            .map(AttributeInstance::getValue)
            .orElse(0.0);
    }

    /** Reads the attribute base value (excluding modifiers). */
    public static double getBaseValue(LivingEntity entity, Holder<Attribute> attribute) {
        return getInstance(entity, attribute)
            .map(AttributeInstance::getBaseValue)
            .orElse(0.0);
    }

    /** Sets the attribute base value. */
    public static void setBaseValue(LivingEntity entity, Holder<Attribute> attribute, double value) {
        getInstance(entity, attribute).ifPresent(inst -> inst.setBaseValue(value));
    }

    /** Adds an AttributeModifier (removes any existing one with the same id first). */
    public static void addModifier(LivingEntity entity, Holder<Attribute> attribute,
                                   AttributeModifier modifier) {
        getInstance(entity, attribute).ifPresent(inst -> {
            inst.removeModifier(modifier.id());
            inst.addPermanentModifier(modifier);
        });
    }

    /** Removes the AttributeModifier with the given id (since 1.21 the modifier id is an Identifier (called ResourceLocation before 1.21.11), no longer a UUID). */
    public static void removeModifier(LivingEntity entity, Holder<Attribute> attribute,
                                      net.minecraft.resources.Identifier id) {
        getInstance(entity, attribute).ifPresent(inst -> inst.removeModifier(id));
    }

    /** Removes all modifiers (keeps only the base value). */
    public static void clearModifiers(LivingEntity entity, Holder<Attribute> attribute) {
        getInstance(entity, attribute).ifPresent(inst ->
            inst.getModifiers().forEach(m -> inst.removeModifier(m.id())));
    }

    // ─── Shortcuts for common attributes ───────────────────────────────────────────

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

import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;

/**
 * AttributeModifier builder.
 *
 * Operation descriptions:
 *  ADDITION        — addition: baseValue + amount
 *  MULTIPLY_BASE   — multiply base: baseValue + baseValue * amount
 *  MULTIPLY_TOTAL  — multiply total: totalValue * (1 + amount)
 */
public final class ModifierBuilder {

    private ModifierBuilder() {}

    /** Creates an addition modifier (e.g. +5 attack damage). */
    public static AttributeModifier addition(String namespace, String path, double amount) {
        return new AttributeModifier(
            Identifier.fromNamespaceAndPath(namespace, path),
            amount,
            AttributeModifier.Operation.ADD_VALUE
        );
    }

    /** Creates a multiply-base modifier (e.g. +10% attack damage). */
    public static AttributeModifier multiplyBase(String namespace, String path, double multiplier) {
        return new AttributeModifier(
            Identifier.fromNamespaceAndPath(namespace, path),
            multiplier,
            AttributeModifier.Operation.ADD_MULTIPLIED_BASE
        );
    }

    /** Creates a multiply-total modifier (e.g. x1.1 after everything else is calculated). */
    public static AttributeModifier multiplyTotal(String namespace, String path, double multiplier) {
        return new AttributeModifier(
            Identifier.fromNamespaceAndPath(namespace, path),
            multiplier,
            AttributeModifier.Operation.ADD_MULTIPLIED_TOTAL
        );
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── rpg/
    ├── AttributeUtil.java
    └── ModifierBuilder.java
```

## Thread Safety

- ⚠️ `AttributeInstance` operations **must be called on the main thread** (NMS entity state is not thread-safe)
- ✅ `ModifierBuilder` methods only build data and can be called from any thread
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| `getInstance` returns empty | The entity does not support the attribute | Verify the EntityType supports it (e.g. Slime has no ATTACK_DAMAGE) |
| Modifier has no effect | Wrong Operation chosen | Check the Operation descriptions and pick the correct calculation |
| Attribute value reset | Modifiers are lost after the entity dies or respawns | Reapply the modifier in EntitySpawnEvent |
| `addModifier` throws IllegalArgumentException | An identical Identifier already exists | Call `removeModifier()` first |
