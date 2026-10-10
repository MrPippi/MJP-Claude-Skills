---
name: nms-nbt-manipulation
description: "直接操作 CompoundTag 讀寫物品、實體、方塊實體的 NBT 資料（Paper NMS + Mojang-mapped）/ Read and write NBT data on items, entities, and block entities via CompoundTag"
---

# NMS NBT Manipulation

## Skill Name

`nms-nbt-manipulation`

## Purpose

Read and write NBT data on items, entities, and block entities directly through the NMS `CompoundTag`, bypassing the limits of the Bukkit PersistentDataContainer API for lower-level persistence and data manipulation.

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- "NBT", "CompoundTag", "NBT 讀寫", "物品 NBT", "實體 NBT"
- "nbt manipulation", "compound tag", "item nbt", "entity nbt", "nbt data"
- "持久化", "NBT 持久化", "nbt persistence"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.nbt` | Package of the generated classes |
| `target` | `item` / `entity` / `block` | Operation target (item, entity, block entity) |
| `class_name` | `NbtHelper` | Utility class name |

## Outputs

- `ItemNbtHelper.java` - Item NBT read/write utility
- `EntityNbtHelper.java` - Entity NBT read/write utility
- `NbtSerializer.java` (optional) - NBT serialization utility for custom objects

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `ItemNbtHelper.java`

```java
package com.example.nbt;

import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;
import org.bukkit.craftbukkit.inventory.CraftItemStack;

import java.util.Optional;

/**
 * Reads and writes custom item NBT.
 * Since 1.20.5 items no longer have getTag()/getOrCreateTag(); custom NBT is stored in the {@code minecraft:custom_data} component.
 */
@SuppressWarnings("UnstableApiUsage")
public final class ItemNbtHelper {

    private ItemNbtHelper() {}

    /** Reads a copy of the item's custom_data (an empty CompoundTag if absent). */
    private static CompoundTag readTag(org.bukkit.inventory.ItemStack item) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        return nms.getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY).copyTag();
    }

    /** Reads a string NBT value. */
    public static Optional<String> getString(org.bukkit.inventory.ItemStack item, String key) {
        // 1.21.5+ CompoundTag getters return Optional directly
        return readTag(item).getString(key);
    }

    /** Writes a string NBT value and returns the modified Bukkit ItemStack (immutable pattern). */
    public static org.bukkit.inventory.ItemStack setString(
            org.bukkit.inventory.ItemStack item, String key, String value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData.update(DataComponents.CUSTOM_DATA, nms, tag -> tag.putString(key, value));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** Reads an integer NBT value. */
    public static int getInt(org.bukkit.inventory.ItemStack item, String key, int def) {
        return readTag(item).getIntOr(key, def);
    }

    /** Writes an integer NBT value and returns the modified Bukkit ItemStack. */
    public static org.bukkit.inventory.ItemStack setInt(
            org.bukkit.inventory.ItemStack item, String key, int value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData.update(DataComponents.CUSTOM_DATA, nms, tag -> tag.putInt(key, value));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** Removes the given NBT key (the component is removed when custom_data becomes empty). */
    public static org.bukkit.inventory.ItemStack removeKey(
            org.bukkit.inventory.ItemStack item, String key) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData.update(DataComponents.CUSTOM_DATA, nms, tag -> tag.remove(key));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** Checks whether the given key exists. */
    public static boolean hasKey(org.bukkit.inventory.ItemStack item, String key) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        return nms.getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY).contains(key);
    }
}
```

### `EntityNbtHelper.java`

```java
package com.example.nbt;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.util.ProblemReporter;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.storage.TagValueInput;
import net.minecraft.world.level.storage.TagValueOutput;
import org.bukkit.craftbukkit.entity.CraftEntity;

@SuppressWarnings("UnstableApiUsage")
public final class EntityNbtHelper {

    private EntityNbtHelper() {}

    /**
     * Reads the entity's full NBT CompoundTag (position, motion, custom data, etc.).
     * Must be called on the main thread.
     */
    public static CompoundTag getTag(org.bukkit.entity.Entity entity) {
        Entity nms = ((CraftEntity) entity).getHandle();
        // 1.21.6+ Entity serialization goes through ValueOutput; TagValueOutput is backed by a CompoundTag
        TagValueOutput output = TagValueOutput.createWithContext(ProblemReporter.DISCARDING, nms.registryAccess());
        nms.saveWithoutId(output);
        return output.buildResult();
    }

    /** Reads a custom tag from the entity (custom keys other than custom_name, Tags, etc.). */
    public static String getString(org.bukkit.entity.Entity entity, String key, String def) {
        return getTag(entity).getStringOr(key, def);
    }

    /**
     * Merges a CompoundTag back into the entity (load/merge).
     * Must be called on the main thread and must not overwrite UUID/position.
     */
    public static void mergeTag(org.bukkit.entity.Entity entity, CompoundTag patch) {
        Entity nms = ((CraftEntity) entity).getHandle();
        CompoundTag current = getTag(entity);
        current.merge(patch);
        nms.load(TagValueInput.create(ProblemReporter.DISCARDING, nms.registryAccess(), current));
    }
}
```

### `NbtSerializer.java` (custom object serialization example)

```java
package com.example.nbt;

import net.minecraft.nbt.CompoundTag;

/** Demonstrates serializing/deserializing a custom object to/from a CompoundTag. */
public final class NbtSerializer {

    private NbtSerializer() {}

    public record PlayerData(String name, int level, double exp) {}

    public static CompoundTag serialize(PlayerData data) {
        CompoundTag tag = new CompoundTag();
        tag.putString("name", data.name());
        tag.putInt("level", data.level());
        tag.putDouble("exp", data.exp());
        return tag;
    }

    public static PlayerData deserialize(CompoundTag tag) {
        // 1.21.5+: getXxx(key) returns Optional, getXxxOr(key, default) returns the raw value
        return new PlayerData(
            tag.getStringOr("name", ""),
            tag.getIntOr("level", 0),
            tag.getDoubleOr("exp", 0.0)
        );
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── nbt/
    ├── ItemNbtHelper.java
    ├── EntityNbtHelper.java
    └── NbtSerializer.java
```

## Thread Safety

- ✅ `ItemNbtHelper` methods operate on NMS copies (the original is not modified) and can be called from any thread
- ⚠️ `EntityNbtHelper.getTag()` / `mergeTag()` access entity state and **must be called on the main thread**
- ⚠️ `nms.save()` / `nms.load()` are not thread-safe; make sure they are called inside the Bukkit scheduler
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| `getTag()` / `getOrCreateTag()` method not found | Since 1.20.5 item NBT lives in the `minecraft:custom_data` component | Use `ItemNbtHelper` (`DataComponents.CUSTOM_DATA` + `CustomData.update()`) |
| Entity misbehaves after merging data | `load()` overwrote position/UUID | Remove the `Pos` and `UUID` keys from the patch before merging |
| `ClassCastException: CraftEntity` | A plugin replaced the entity implementation | Use `nms-reflection-bridge` to obtain the handle |
| NBT key disappears (after reload) | PersistentDataContainer not used | For persistence across restarts, use PDC or SQL |
