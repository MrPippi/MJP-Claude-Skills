---
name: nms-data-component
description: "操作 Minecraft DataComponentType（1.20.5+） 物品組件系統，讀寫 CustomData、MaxStackSize、Enchantments 等組件（Paper NMS + Mojang-mapped）/ Read and write 1.21 DataComponentType item components including CustomData, MaxStackSize, Enchantments"
---

# NMS Data Component

## Skill Name

`nms-data-component`

## Purpose

Work with the `DataComponentType` item component system introduced in Minecraft 1.20.5. Read and write components such as `CustomData`, `MaxStackSize`, `Enchantments` and `AttributeModifiers` directly, replacing the legacy NBT `getTag()`/`setTag()` pattern.

## NMS Version Requirements

- Paper 1.21.11 / 26.2(DataComponent was added in 1.20.5+)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- "DataComponent", "data component", "物品組件", "1.21 item data", "ItemStack component"
- "DataComponentType", "CustomData component", "component map", "item component"
- "DataComponents", "組件讀寫", "component api"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.item` | Package of the generated classes |
| `class_name` | `ItemComponentUtil` | Utility class name |

## Outputs

- `ItemComponentUtil.java` — DataComponent read/write utility
- `CustomDataHelper.java` — CustomData (custom NBT component) operations

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `ItemComponentUtil.java`

```java
package com.example.item;

import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.util.Unit;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.TooltipDisplay;
import net.minecraft.world.item.enchantment.ItemEnchantments;
import org.bukkit.craftbukkit.inventory.CraftItemStack;

import java.util.Optional;

@SuppressWarnings("UnstableApiUsage")
public final class ItemComponentUtil {

    private ItemComponentUtil() {}

    /** Reads the value of the given DataComponentType. */
    public static <T> Optional<T> get(
            org.bukkit.inventory.ItemStack item, DataComponentType<T> type) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        return Optional.ofNullable(nms.get(type));
    }

    /** Sets the given DataComponentType and returns the modified Bukkit ItemStack (immutable). */
    public static <T> org.bukkit.inventory.ItemStack set(
            org.bukkit.inventory.ItemStack item, DataComponentType<T> type, T value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        nms.set(type, value);
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** Removes the given DataComponentType. */
    public static org.bukkit.inventory.ItemStack remove(
            org.bukkit.inventory.ItemStack item, DataComponentType<?> type) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        nms.remove(type);
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** Checks whether the item has the given component. */
    public static boolean has(
            org.bukkit.inventory.ItemStack item, DataComponentType<?> type) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        return nms.has(type);
    }

    // ─── Common component shortcuts ───────────────────────────────────

    /** Sets the item's max stack size. */
    public static org.bukkit.inventory.ItemStack setMaxStackSize(
            org.bukkit.inventory.ItemStack item, int size) {
        return set(item, DataComponents.MAX_STACK_SIZE, size);
    }

    /**
     * Makes the item unbreakable.
     * Since 1.21.5, UNBREAKABLE is a Unit marker component; whether the tooltip is shown is controlled by hiddenComponents in TOOLTIP_DISPLAY.
     */
    public static org.bukkit.inventory.ItemStack setUnbreakable(
            org.bukkit.inventory.ItemStack item, boolean showTooltip) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        nms.set(DataComponents.UNBREAKABLE, Unit.INSTANCE);
        TooltipDisplay display = nms.getOrDefault(DataComponents.TOOLTIP_DISPLAY, TooltipDisplay.DEFAULT);
        nms.set(DataComponents.TOOLTIP_DISPLAY, display.withHidden(DataComponents.UNBREAKABLE, !showTooltip));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** Reads the enchantment list. */
    public static Optional<ItemEnchantments> getEnchantments(
            org.bukkit.inventory.ItemStack item) {
        return get(item, DataComponents.ENCHANTMENTS);
    }

    /**
     * Reads the first float value of the custom model data.
     * Since 1.21.4, CustomModelData is no longer a single int but four lists: floats / flags / strings / colors.
     */
    public static Optional<Float> getCustomModelData(
            org.bukkit.inventory.ItemStack item) {
        return get(item, DataComponents.CUSTOM_MODEL_DATA)
            .filter(cmd -> !cmd.floats().isEmpty())
            .map(cmd -> cmd.floats().get(0));
    }
}
```

### `CustomDataHelper.java` (custom NBT component)

```java
package com.example.item;

import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;
import org.bukkit.craftbukkit.inventory.CraftItemStack;

import java.util.Optional;

/**
 * CustomData component operations (replaces the legacy getTag().getCompound("custom_key") pattern).
 *
 * Since 1.20.5, CustomData is a standalone component stored under DataComponents.CUSTOM_DATA;
 * custom keys are no longer stored directly at the root tag level.
 */
@SuppressWarnings("UnstableApiUsage")
public final class CustomDataHelper {

    private CustomDataHelper() {}

    /** Reads the given string field from the CustomData component. */
    public static Optional<String> getString(
            org.bukkit.inventory.ItemStack item, String key) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData customData = nms.get(DataComponents.CUSTOM_DATA);
        if (customData == null) return Optional.empty();
        // Since 1.21.5, CompoundTag getters return Optional (there is also getStringOr(key, default))
        return customData.copyTag().getString(key);
    }

    /** Writes a string into the CustomData component and returns the modified Bukkit ItemStack. */
    public static org.bukkit.inventory.ItemStack setString(
            org.bukkit.inventory.ItemStack item, String key, String value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData existing = nms.getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY);
        CompoundTag tag = existing.copyTag();
        tag.putString(key, value);
        nms.set(DataComponents.CUSTOM_DATA, CustomData.of(tag));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** Writes an integer into the CustomData component. */
    public static org.bukkit.inventory.ItemStack setInt(
            org.bukkit.inventory.ItemStack item, String key, int value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData existing = nms.getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY);
        CompoundTag tag = existing.copyTag();
        tag.putInt(key, value);
        nms.set(DataComponents.CUSTOM_DATA, CustomData.of(tag));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** Removes the given field from CustomData. */
    public static org.bukkit.inventory.ItemStack removeKey(
            org.bukkit.inventory.ItemStack item, String key) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData existing = nms.get(DataComponents.CUSTOM_DATA);
        if (existing == null) return item;
        CompoundTag tag = existing.copyTag();
        tag.remove(key);
        nms.set(DataComponents.CUSTOM_DATA, CustomData.of(tag));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** Returns a copy of the full CustomData CompoundTag. */
    public static CompoundTag getTag(org.bukkit.inventory.ItemStack item) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData customData = nms.get(DataComponents.CUSTOM_DATA);
        return customData != null ? customData.copyTag() : new CompoundTag();
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── item/
    ├── ItemComponentUtil.java
    └── CustomDataHelper.java
```

## Thread Safety

- ✅ `ItemComponentUtil` / `CustomDataHelper` operate on NMS copies and **do not modify world state directly**, so they can be called from any thread
- ⚠️ Updating an ItemStack in a Bukkit inventory (e.g. `player.getInventory().setItem()`) **must happen on the main thread**
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| `get()` returns empty | Component is not set | Use `getOrDefault()` to provide a default value |
| `CustomData` data is lost | Written with the legacy `getTag()` (removed in 1.20.5+) | Use `CustomDataHelper.setString()` instead |
| `CustomModelData.value()` does not exist | Since 1.21.4 it is four lists: floats / flags / strings / colors | Access the lists via `floats()` etc. (see `getCustomModelData()`) |
| Component change has no effect | You modified an NMS copy, not the original object | Return the result via `CraftItemStack.asBukkitCopy()` and update the inventory |
