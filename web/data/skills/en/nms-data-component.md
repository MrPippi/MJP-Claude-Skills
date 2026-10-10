# NMS Data Component

## Purpose

Work with the `DataComponentType` item component system introduced in Minecraft 1.20.5, reading and writing components such as `CustomData`, `MaxStackSize`, `Enchantments`, and `AttributeModifiers` directly, replacing the old NBT `getTag()`/`setTag()` pattern.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (DataComponent was added in 1.20.5+)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### ItemComponentUtil.java

```java
// Read the MaxStackSize component
Optional<Integer> maxStack = ItemComponentUtil.get(item, DataComponents.MAX_STACK_SIZE);

// Set unbreakable (UNBREAKABLE is a Unit marker component; returns a new ItemStack, the original is unchanged)
ItemStack unbreakable = ItemComponentUtil.setUnbreakable(item, true);

// Remove a component
ItemStack clean = ItemComponentUtil.remove(item, DataComponents.CUSTOM_DATA);
```

### CustomDataHelper.java (custom NBT component)

```java
// Write custom string data
ItemStack tagged = CustomDataHelper.setString(item, "rarity", "legendary");

// Read custom integer data (getTag returns a copy of the custom_data CompoundTag)
int level = CustomDataHelper.getTag(item).getInt("weapon_level");

// Check whether a given key exists
boolean hasTag = CustomDataHelper.getTag(item).contains("owner_uuid");
```

---

## Thread Safety

- `ItemComponentUtil` operates on NMS copies and can be called from any thread
- Applying the modified ItemStack to the player inventory must be done on the main thread
