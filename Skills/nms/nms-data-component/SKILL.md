---
name: nms-data-component
description: "操作 Minecraft DataComponentType（1.20.5+） 物品組件系統，讀寫 CustomData、MaxStackSize、Enchantments 等組件（Paper NMS + Mojang-mapped）/ Read and write 1.21 DataComponentType item components including CustomData, MaxStackSize, Enchantments"
---

# NMS Data Component / NMS 物品組件系統

## 技能名稱 / Skill Name

`nms-data-component`

## 目的 / Purpose

操作 Minecraft 1.20.5 引入的 `DataComponentType` 物品組件系統，直接讀寫 `CustomData`、`MaxStackSize`、`Enchantments`、`AttributeModifiers` 等組件，取代舊版 NBT `getTag()`/`setTag()` 模式。

## NMS 版本需求 / NMS Version Requirements

- Paper 26.2（DataComponent 為 1.20.5+ 新增）
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）

## 觸發條件 / Triggers

- 「DataComponent」「data component」「物品組件」「1.21 item data」「ItemStack component」
- 「DataComponentType」「CustomData component」「component map」「item component」
- 「DataComponents」「組件讀寫」「component api」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.item` | 產出類別所在 package |
| `class_name` | `ItemComponentUtil` | 工具類名稱 |

## 輸出產物 / Outputs

- `ItemComponentUtil.java` — DataComponent 讀寫工具
- `CustomDataHelper.java` — CustomData（自定義 NBT 組件）操作

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## 代碼範本 / Code Template

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

    /** 讀取指定 DataComponentType 的值。 */
    public static <T> Optional<T> get(
            org.bukkit.inventory.ItemStack item, DataComponentType<T> type) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        return Optional.ofNullable(nms.get(type));
    }

    /** 設定指定 DataComponentType 並回傳修改後的 Bukkit ItemStack（不可變）。 */
    public static <T> org.bukkit.inventory.ItemStack set(
            org.bukkit.inventory.ItemStack item, DataComponentType<T> type, T value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        nms.set(type, value);
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** 移除指定 DataComponentType。 */
    public static org.bukkit.inventory.ItemStack remove(
            org.bukkit.inventory.ItemStack item, DataComponentType<?> type) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        nms.remove(type);
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** 檢查是否含有指定組件。 */
    public static boolean has(
            org.bukkit.inventory.ItemStack item, DataComponentType<?> type) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        return nms.has(type);
    }

    // ─── 常用組件快捷 ─────────────────────────────────────────────────

    /** 設定物品最大堆疊數。 */
    public static org.bukkit.inventory.ItemStack setMaxStackSize(
            org.bukkit.inventory.ItemStack item, int size) {
        return set(item, DataComponents.MAX_STACK_SIZE, size);
    }

    /**
     * 設定物品為不可破壞。
     * 1.21.5+ UNBREAKABLE 是 Unit 標記組件；是否顯示提示改由 TOOLTIP_DISPLAY 的 hiddenComponents 控制。
     */
    public static org.bukkit.inventory.ItemStack setUnbreakable(
            org.bukkit.inventory.ItemStack item, boolean showTooltip) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        nms.set(DataComponents.UNBREAKABLE, Unit.INSTANCE);
        TooltipDisplay display = nms.getOrDefault(DataComponents.TOOLTIP_DISPLAY, TooltipDisplay.DEFAULT);
        nms.set(DataComponents.TOOLTIP_DISPLAY, display.withHidden(DataComponents.UNBREAKABLE, !showTooltip));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** 讀取附魔列表。 */
    public static Optional<ItemEnchantments> getEnchantments(
            org.bukkit.inventory.ItemStack item) {
        return get(item, DataComponents.ENCHANTMENTS);
    }

    /**
     * 讀取自定義模型資料的第一個 float 值。
     * 1.21.4+ CustomModelData 不再是單一 int，而是 floats / flags / strings / colors 四個清單。
     */
    public static Optional<Float> getCustomModelData(
            org.bukkit.inventory.ItemStack item) {
        return get(item, DataComponents.CUSTOM_MODEL_DATA)
            .filter(cmd -> !cmd.floats().isEmpty())
            .map(cmd -> cmd.floats().get(0));
    }
}
```

### `CustomDataHelper.java`（自定義 NBT 組件）

```java
package com.example.item;

import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;
import org.bukkit.craftbukkit.inventory.CraftItemStack;

import java.util.Optional;

/**
 * CustomData 組件操作（對應舊版 getTag().getCompound("custom_key") 模式）。
 *
 * 1.20.5+ 的 CustomData 是獨立組件，儲存在 DataComponents.CUSTOM_DATA 下，
 * 不再直接在 root tag 層級存放自定義鍵。
 */
@SuppressWarnings("UnstableApiUsage")
public final class CustomDataHelper {

    private CustomDataHelper() {}

    /** 讀取 CustomData 組件中的指定字串欄位。 */
    public static Optional<String> getString(
            org.bukkit.inventory.ItemStack item, String key) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData customData = nms.get(DataComponents.CUSTOM_DATA);
        if (customData == null) return Optional.empty();
        // 1.21.5+ CompoundTag getter 回傳 Optional（另有 getStringOr(key, default)）
        return customData.copyTag().getString(key);
    }

    /** 寫入字串到 CustomData 組件，回傳修改後的 Bukkit ItemStack。 */
    public static org.bukkit.inventory.ItemStack setString(
            org.bukkit.inventory.ItemStack item, String key, String value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData existing = nms.getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY);
        CompoundTag tag = existing.copyTag();
        tag.putString(key, value);
        nms.set(DataComponents.CUSTOM_DATA, CustomData.of(tag));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** 寫入整數到 CustomData 組件。 */
    public static org.bukkit.inventory.ItemStack setInt(
            org.bukkit.inventory.ItemStack item, String key, int value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData existing = nms.getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY);
        CompoundTag tag = existing.copyTag();
        tag.putInt(key, value);
        nms.set(DataComponents.CUSTOM_DATA, CustomData.of(tag));
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** 移除 CustomData 中的指定欄位。 */
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

    /** 取得完整的 CustomData CompoundTag 副本。 */
    public static CompoundTag getTag(org.bukkit.inventory.ItemStack item) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CustomData customData = nms.get(DataComponents.CUSTOM_DATA);
        return customData != null ? customData.copyTag() : new CompoundTag();
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── item/
    ├── ItemComponentUtil.java
    └── CustomDataHelper.java
```

## 執行緒安全注意事項 / Thread Safety

- ✅ `ItemComponentUtil` / `CustomDataHelper` 操作 NMS Copy，**不直接修改世界狀態**，可在任意執行緒呼叫
- ⚠️ 若需要在 Bukkit 物品欄中更新 ItemStack（如 `player.getInventory().setItem()`），**必須在主執行緒**
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `get()` 回傳 empty | 組件未設定 | 使用 `getOrDefault()` 提供預設值 |
| `CustomData` 資料丟失 | 使用舊版 `getTag()` 寫入（1.20.5+ 已移除） | 改用 `CustomDataHelper.setString()` |
| `CustomModelData.value()` 不存在 | 1.21.4+ 改為 floats / flags / strings / colors 四個清單 | 改用 `floats()` 等清單存取（見 `getCustomModelData()`） |
| 組件設定後不生效 | 操作的是 NMS Copy 而非原物件 | 確保用 `CraftItemStack.asBukkitCopy()` 回傳並更新 inventory |
