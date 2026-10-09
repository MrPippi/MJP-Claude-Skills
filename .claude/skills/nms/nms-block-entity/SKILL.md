---
name: nms-block-entity
description: "實作自定義 NMS BlockEntity（含 NBT 序列化、Tick 邏輯、客戶端同步），比 Bukkit BlockState 更靈活（Paper NMS + Mojang-mapped）/ Implement custom NMS BlockEntity with NBT serialization, tick logic, and client sync"
---

# NMS Block Entity / NMS 自定義方塊實體

## 技能名稱 / Skill Name

`nms-block-entity`

## 目的 / Purpose

繼承 NMS `BlockEntity` 實作自定義方塊實體，實現 NBT 讀寫、伺服器端 Tick 邏輯（`BlockEntityTicker`）、以及透過封包同步狀態至客戶端。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21 – 1.21.3
- Paperweight userdev 1.7.2+
- Mojang mappings（已由 Paper 1.20.5+ 原生支援）

## 觸發條件 / Triggers

- 「BlockEntity」「TileEntity」「自定義方塊實體」「block entity」「tile entity」
- 「方塊 tick」「block tick」「BlockEntityTicker」「方塊 NBT」「block nbt」
- 「自定義方塊 NMS」「custom block nms」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.block` | 產出類別所在 package |
| `entity_class_name` | `GeneratorBlockEntity` | BlockEntity 子類名 |
| `has_ticker` | `true` | 是否需要 tick 邏輯 |
| `base_block` | `CHEST` | 用哪個 NMS 方塊作為載體 |

## 輸出產物 / Outputs

- `CustomBlockEntity.java` — BlockEntity 實作（含 NBT load/save）
- `CustomBlockEntityTicker.java`（選）— ServerLevel tick 邏輯
- `BlockEntityHelper.java` — 在世界中取得/設定 BlockEntity 工具

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}
```

## 代碼範本 / Code Template

### `CustomBlockEntity.java`

```java
package com.example.block;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientGamePacketListener;
import net.minecraft.network.protocol.game.ClientboundBlockEntityDataPacket;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;

import javax.annotation.Nullable;

@SuppressWarnings("UnstableApiUsage")
public class CustomBlockEntity extends BlockEntity {

    // 自定義欄位
    private int storedEnergy = 0;
    private String ownerName = "";

    public CustomBlockEntity(BlockEntityType<?> type, BlockPos pos, BlockState state) {
        super(type, pos, state);
    }

    // ─── NBT 序列化 ──────────────────────────────────────────────────

    /** 儲存自定義資料到 NBT（世界儲存 + 封包同步）。 */
    @Override
    protected void saveAdditional(CompoundTag tag, HolderLookup.Provider provider) {
        super.saveAdditional(tag, provider);
        tag.putInt("storedEnergy", storedEnergy);
        tag.putString("ownerName", ownerName);
    }

    /** 從 NBT 讀取自定義資料（世界載入 + 封包接收）。 */
    @Override
    public void loadAdditional(CompoundTag tag, HolderLookup.Provider provider) {
        super.loadAdditional(tag, provider);
        storedEnergy = tag.getInt("storedEnergy");
        ownerName = tag.getString("ownerName");
    }

    // ─── 客戶端同步 ──────────────────────────────────────────────────

    /** 產生傳送給客戶端的更新封包（BlockEntityDataPacket）。 */
    @Override
    @Nullable
    public Packet<ClientGamePacketListener> getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }

    /** 取得用於封包同步的 NBT（可只傳必要欄位）。 */
    @Override
    public CompoundTag getUpdateTag(HolderLookup.Provider provider) {
        return saveWithoutMetadata(provider);
    }

    /** 通知客戶端狀態變更（呼叫後自動發送更新封包）。 */
    public void markDirtyAndSync() {
        setChanged();
        if (level != null && !level.isClientSide) {
            level.sendBlockUpdated(worldPosition, getBlockState(), getBlockState(), 3);
        }
    }

    // ─── Getter/Setter ───────────────────────────────────────────────

    public int getStoredEnergy() { return storedEnergy; }

    public void setStoredEnergy(int energy) {
        this.storedEnergy = energy;
        markDirtyAndSync();
    }

    public String getOwnerName() { return ownerName; }

    public void setOwnerName(String name) {
        this.ownerName = name;
        markDirtyAndSync();
    }
}
```

### `CustomBlockEntityTicker.java`（Tick 邏輯）

```java
package com.example.block;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.state.BlockState;

@SuppressWarnings("UnstableApiUsage")
public class CustomBlockEntityTicker implements BlockEntityTicker<CustomBlockEntity> {

    private static final int TICK_INTERVAL = 20; // 每秒執行一次
    private int tickCount = 0;

    @Override
    public void tick(Level level, BlockPos pos, BlockState state, CustomBlockEntity entity) {
        if (level.isClientSide) return; // 只在伺服器端執行

        tickCount++;
        if (tickCount % TICK_INTERVAL != 0) return;

        // 每 20 tick（1 秒）執行一次邏輯
        if (entity.getStoredEnergy() < 1000) {
            entity.setStoredEnergy(entity.getStoredEnergy() + 10);
        }
    }
}
```

### `BlockEntityHelper.java`（世界操作工具）

```java
package com.example.block;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.craftbukkit.v1_21_R1.CraftWorld;

import java.util.Optional;

@SuppressWarnings("UnstableApiUsage")
public final class BlockEntityHelper {

    private BlockEntityHelper() {}

    /** 取得指定位置的 BlockEntity（若類型不匹配回傳 empty）。 */
    @SuppressWarnings("unchecked")
    public static <T extends BlockEntity> Optional<T> get(
            Location loc, Class<T> type) {
        net.minecraft.world.level.Level level = ((CraftWorld) loc.getWorld()).getHandle();
        BlockPos pos = new BlockPos(loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        BlockEntity be = level.getBlockEntity(pos);
        if (type.isInstance(be)) return Optional.of(type.cast(be));
        return Optional.empty();
    }

    /** 取得指定位置的自定義 BlockEntity。 */
    public static Optional<CustomBlockEntity> getCustom(Location loc) {
        return get(loc, CustomBlockEntity.class);
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── block/
    ├── CustomBlockEntity.java
    ├── CustomBlockEntityTicker.java
    └── BlockEntityHelper.java
```

## 執行緒安全注意事項 / Thread Safety

- ⚠️ 所有 BlockEntity 操作（讀取、修改、`markDirtyAndSync()`）**必須在主執行緒呼叫**
- ⚠️ `tick()` 由 NMS 在主執行緒呼叫，內部不可進行阻塞 IO
- ⚠️ `level.isClientSide` 必須在 tick 內檢查，防止在客戶端 Tick 執行伺服器邏輯
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| NBT 資料丟失 | `saveAdditional` 未呼叫 `super` | 確保呼叫 `super.saveAdditional(tag, provider)` |
| 客戶端不同步 | 未呼叫 `markDirtyAndSync()` | 每次修改欄位後呼叫 |
| `getBlockEntity()` 回傳 null | 方塊位置無 BlockEntity | 確認方塊類型有 BlockEntity 支援 |
| tick 未執行 | BlockEntityType 未正確注冊 | Paper plugin 環境需透過 RegistryAccess 注冊類型 |
