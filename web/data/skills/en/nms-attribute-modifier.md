# NMS Attribute Modifier

## Purpose

Precisely control entity attributes through NMS `AttributeMap`, `AttributeInstance`, and `AttributeModifier`. Supports additive, multiplicative, and base-value modifications for RPG equipment bonuses and buff/debuff systems.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### AttributeUtil.java

```java
// Get the final attribute value (after all modifiers are applied)
double hp = AttributeUtil.getValue(player, Attributes.MAX_HEALTH);

// Add an additive modifier (+10 attack damage)
AttributeUtil.addModifier(player, Attributes.ATTACK_DAMAGE,
    ModifierBuilder.addition("myplugin", "sword_bonus", 10.0));

// Remove a specific modifier (since 1.21 the id is an Identifier, formerly ResourceLocation)
AttributeUtil.removeModifier(player, Attributes.ATTACK_DAMAGE,
    Identifier.fromNamespaceAndPath("myplugin", "sword_bonus"));
```

### ModifierBuilder.java (builder)

```java
// Addition (baseValue + amount)
AttributeModifier mod = ModifierBuilder.addition("myplugin", "buff_id", 5.0);

// Multiply base (baseValue + baseValue * amount)
AttributeModifier mod = ModifierBuilder.multiplyBase("myplugin", "speed_boost", 0.2);

// Multiply total (totalValue * (1 + amount))
AttributeModifier mod = ModifierBuilder.multiplyTotal("myplugin", "debuff", -0.1);
```

---

## Thread Safety

- `AttributeUtil` accesses entity state, so it **must be called on the main thread**
