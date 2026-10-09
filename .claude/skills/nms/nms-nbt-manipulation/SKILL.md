---
name: nms-nbt-manipulation
description: "直接操作 CompoundTag 讀寫物品、實體、方塊實體的 NBT 資料（Paper NMS + Mojang-mapped）/ Read and write NBT data on items, entities, and block entities via CompoundTag"
---

# NMS NBT Manipulation / NMS NBT 操作

## 技能名稱 / Skill Name

`nms-nbt-manipulation`

## 目的 / Purpose

透過 NMS `CompoundTag` 直接讀寫物品、實體、方塊實體的 NBT 資料，繞過 Bukkit PersistentDataContainer API 的限制，實現更底層的持久化與資料操作。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21 – 1.21.3
- Paperweight userdev 1.7.2+
- Mojang mappings（已由 Paper 1.20.5+ 原生支援）

## 觸發條件 / Triggers

- 「NBT」「CompoundTag」「NBT 讀寫」「物品 NBT」「實體 NBT」
- 「nbt manipulation」「compound tag」「item nbt」「entity nbt」「nbt data」
- 「持久化」「NBT 持久化」「nbt persistence」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.nbt` | 產出類別所在 package |
| `target` | `item` / `entity` / `block` | 操作目標（物品、實體、方塊實體） |
| `class_name` | `NbtHelper` | 工具類名稱 |

## 輸出產物 / Outputs

- `ItemNbtHelper.java` — 物品 NBT 讀寫工具
- `EntityNbtHelper.java` — 實體 NBT 讀寫工具
- `NbtSerializer.java`（選）— 自定義物件 NBT 序列化工具

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}
```

## 代碼範本 / Code Template

### `ItemNbtHelper.java`

```java
package com.example.nbt;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.item.ItemStack;
import org.bukkit.craftbukkit.v1_21_R1.inventory.CraftItemStack;

import java.util.Optional;

@SuppressWarnings("UnstableApiUsage")
public final class ItemNbtHelper {

    private ItemNbtHelper() {}

    /** 取得物品的 NMS ItemStack 並讀取自定義 NBT 標籤。 */
    public static Optional<String> getString(org.bukkit.inventory.ItemStack item, String key) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CompoundTag tag = nms.getTag();
        if (tag == null || !tag.contains(key)) return Optional.empty();
        return Optional.of(tag.getString(key));
    }

    /** 寫入字串 NBT 並回傳修改後的 Bukkit ItemStack（不可變模式）。 */
    public static org.bukkit.inventory.ItemStack setString(
            org.bukkit.inventory.ItemStack item, String key, String value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CompoundTag tag = nms.getOrCreateTag();
        tag.putString(key, value);
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** 讀取整數 NBT。 */
    public static int getInt(org.bukkit.inventory.ItemStack item, String key, int def) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CompoundTag tag = nms.getTag();
        return (tag != null && tag.contains(key)) ? tag.getInt(key) : def;
    }

    /** 寫入整數 NBT 並回傳修改後的 Bukkit ItemStack。 */
    public static org.bukkit.inventory.ItemStack setInt(
            org.bukkit.inventory.ItemStack item, String key, int value) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CompoundTag tag = nms.getOrCreateTag();
        tag.putInt(key, value);
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** 移除指定 NBT 鍵。 */
    public static org.bukkit.inventory.ItemStack removeKey(
            org.bukkit.inventory.ItemStack item, String key) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CompoundTag tag = nms.getTag();
        if (tag != null) tag.remove(key);
        return CraftItemStack.asBukkitCopy(nms);
    }

    /** 檢查是否含有指定鍵。 */
    public static boolean hasKey(org.bukkit.inventory.ItemStack item, String key) {
        ItemStack nms = CraftItemStack.asNMSCopy(item);
        CompoundTag tag = nms.getTag();
        return tag != null && tag.contains(key);
    }
}
```

### `EntityNbtHelper.java`

```java
package com.example.nbt;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.entity.Entity;
import org.bukkit.craftbukkit.v1_21_R1.entity.CraftEntity;

@SuppressWarnings("UnstableApiUsage")
public final class EntityNbtHelper {

    private EntityNbtHelper() {}

    /**
     * 讀取實體的完整 NBT CompoundTag（含位置、速度、自定義資料等）。
     * 必須在主執行緒呼叫。
     */
    public static CompoundTag getTag(org.bukkit.entity.Entity entity) {
        Entity nms = ((CraftEntity) entity).getHandle();
        CompoundTag tag = new CompoundTag();
        nms.save(tag);
        return tag;
    }

    /** 讀取實體自定義 tag（custom_name, Tags 等之外的自定義鍵）。 */
    public static String getString(org.bukkit.entity.Entity entity, String key, String def) {
        CompoundTag tag = getTag(entity);
        return tag.contains(key) ? tag.getString(key) : def;
    }

    /**
     * 將 CompoundTag 合併回實體（load/merge）。
     * 必須在主執行緒呼叫，且不可覆寫 UUID/位置。
     */
    public static void mergeTag(org.bukkit.entity.Entity entity, CompoundTag patch) {
        Entity nms = ((CraftEntity) entity).getHandle();
        CompoundTag current = new CompoundTag();
        nms.save(current);
        current.merge(patch);
        nms.load(current);
    }
}
```

### `NbtSerializer.java`（自定義物件序列化範例）

```java
package com.example.nbt;

import net.minecraft.nbt.CompoundTag;

/** 示範如何將自定義物件序列化/反序列化為 CompoundTag。 */
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
        return new PlayerData(
            tag.getString("name"),
            tag.getInt("level"),
            tag.getDouble("exp")
        );
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── nbt/
    ├── ItemNbtHelper.java
    ├── EntityNbtHelper.java
    └── NbtSerializer.java
```

## 執行緒安全注意事項 / Thread Safety

- ✅ `ItemNbtHelper` 的方法操作 NMS Copy（不修改原物件），可在任何執行緒呼叫
- ⚠️ `EntityNbtHelper.getTag()` / `mergeTag()` 存取實體狀態，**必須在主執行緒呼叫**
- ⚠️ `nms.save()` / `nms.load()` 不執行緒安全，確保在 Bukkit scheduler 內呼叫
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `getTag()` 回傳 null | 物品無自定義 NBT | 改用 `getOrCreateTag()` |
| 資料合併後實體行為異常 | `load()` 覆寫了位置/UUID | 合併前從 patch 移除 `Pos`、`UUID` 鍵 |
| `ClassCastException: CraftEntity` | 外掛替換實體實作 | 改用 `nms-reflection-bridge` 取得 handle |
| NBT 鍵消失（重載後） | 未使用 PersistentDataContainer | 若需跨重啟持久化，改用 PDC 或 SQL |
