---
name: nms-chunk-access
description: "透過 NMS LevelChunk 直接讀寫方塊、高度圖、ChunkSection 資料，比 Bukkit Chunk API 更快更底層（Paper NMS + Mojang-mapped）/ Direct LevelChunk block, heightmap, and ChunkSection access for high-performance operations"
---

# NMS Chunk Access / NMS 區塊直接存取

## 技能名稱 / Skill Name

`nms-chunk-access`

## 目的 / Purpose

透過 NMS `LevelChunk`、`ChunkAccess`、`LevelChunkSection` 直接讀寫方塊狀態與高度圖，繞過 Bukkit `Chunk.getBlock()` 的逐格開銷，實現高效能的大範圍方塊操作（如結構生成、地圖掃描）。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21 – 1.21.3
- Paperweight userdev 1.7.2+
- Mojang mappings（已由 Paper 1.20.5+ 原生支援）

## 觸發條件 / Triggers

- 「chunk access」「LevelChunk」「區塊操作」「chunk data」「直接讀寫方塊」
- 「ChunkSection」「heightmap」「高度圖」「chunk NMS」「bulk block」
- 「大量方塊」「高效能方塊操作」「structure paste」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.world` | 產出類別所在 package |
| `class_name` | `ChunkAccessUtil` | 工具類名稱 |

## 輸出產物 / Outputs

- `ChunkAccessUtil.java` — LevelChunk 讀寫工具
- `BulkBlockEditor.java` — 批次方塊操作（最小化客戶端更新）

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}
```

## 代碼範本 / Code Template

### `ChunkAccessUtil.java`

```java
package com.example.world;

import net.minecraft.core.BlockPos;
import net.minecraft.core.SectionPos;
import net.minecraft.world.level.LightLayer;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.LevelChunk;
import net.minecraft.world.level.chunk.LevelChunkSection;
import net.minecraft.world.level.levelgen.Heightmap;
import org.bukkit.Chunk;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.craftbukkit.v1_21_R1.CraftChunk;
import org.bukkit.craftbukkit.v1_21_R1.CraftWorld;

@SuppressWarnings("UnstableApiUsage")
public final class ChunkAccessUtil {

    private ChunkAccessUtil() {}

    /** 取得 NMS LevelChunk。 */
    public static LevelChunk getChunk(Chunk chunk) {
        return ((CraftChunk) chunk).getHandle(net.minecraft.world.level.chunk.status.ChunkStatus.FULL);
    }

    /** 取得指定世界座標的 NMS BlockState（不觸發光照更新）。 */
    public static BlockState getBlockState(Location loc) {
        net.minecraft.world.level.Level level = ((CraftWorld) loc.getWorld()).getHandle();
        BlockPos pos = new BlockPos(loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        return level.getChunk(pos).getBlockState(pos);
    }

    /**
     * 直接設定方塊狀態（跳過部分 Bukkit 處理，效能較高）。
     * flags: 1=update neighbors, 2=send to clients, 3=both
     * 必須在主執行緒呼叫。
     */
    public static void setBlockState(Location loc, BlockState state, int flags) {
        net.minecraft.world.level.Level level = ((CraftWorld) loc.getWorld()).getHandle();
        BlockPos pos = new BlockPos(loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        level.setBlock(pos, state, flags);
    }

    /** 取得指定 X/Z 位置的地面高度（WORLD_SURFACE 高度圖）。 */
    public static int getSurfaceHeight(World world, int x, int z) {
        net.minecraft.world.level.Level level = ((CraftWorld) world).getHandle();
        BlockPos pos = new BlockPos(x, 0, z);
        LevelChunk chunk = level.getChunkAt(pos);
        return chunk.getHeight(Heightmap.Types.WORLD_SURFACE, x & 15, z & 15);
    }

    /** 取得指定 X/Z 位置的動態高度（MOTION_BLOCKING，含水）。 */
    public static int getMotionBlockingHeight(World world, int x, int z) {
        net.minecraft.world.level.Level level = ((CraftWorld) world).getHandle();
        BlockPos pos = new BlockPos(x, 0, z);
        LevelChunk chunk = level.getChunkAt(pos);
        return chunk.getHeight(Heightmap.Types.MOTION_BLOCKING, x & 15, z & 15);
    }

    /** 取得 ChunkSection（16 格高的子區段），sectionY 為 section index（非方塊 Y）。 */
    public static LevelChunkSection getSection(Chunk chunk, int sectionY) {
        LevelChunk nms = getChunk(chunk);
        return nms.getSections()[sectionY - nms.getMinSection()];
    }

    /** 讀取 ChunkSection 中的方塊狀態（localX/Y/Z 為 0-15 相對座標）。 */
    public static BlockState getSectionBlockState(
            LevelChunkSection section, int localX, int localY, int localZ) {
        return section.getBlockState(localX, localY, localZ);
    }

    /** 取得指定位置的光照等級（SKY 或 BLOCK）。 */
    public static int getLightLevel(Location loc, LightLayer layer) {
        net.minecraft.world.level.Level level = ((CraftWorld) loc.getWorld()).getHandle();
        BlockPos pos = new BlockPos(loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        return level.getBrightness(layer, pos);
    }
}
```

### `BulkBlockEditor.java`（批次方塊操作）

```java
package com.example.world;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.LevelChunk;
import org.bukkit.World;
import org.bukkit.craftbukkit.v1_21_R1.CraftWorld;

import java.util.HashMap;
import java.util.Map;

/**
 * 批次方塊操作工具。
 * 收集所有修改後一次性提交，減少客戶端更新封包數量。
 * 必須在主執行緒使用。
 */
@SuppressWarnings("UnstableApiUsage")
public class BulkBlockEditor {

    private final net.minecraft.world.level.Level level;
    private final Map<BlockPos, BlockState> pending = new HashMap<>();

    public BulkBlockEditor(World world) {
        this.level = ((CraftWorld) world).getHandle();
    }

    /** 排隊一個方塊修改。 */
    public BulkBlockEditor set(int x, int y, int z, BlockState state) {
        pending.put(new BlockPos(x, y, z), state);
        return this;
    }

    /** 排隊填充一個立方體範圍（minX..maxX, minY..maxY, minZ..maxZ）。 */
    public BulkBlockEditor fill(int x1, int y1, int z1, int x2, int y2, int z2, BlockState state) {
        for (int x = x1; x <= x2; x++)
            for (int y = y1; y <= y2; y++)
                for (int z = z1; z <= z2; z++)
                    pending.put(new BlockPos(x, y, z), state);
        return this;
    }

    /**
     * 提交所有修改。
     * flags=2 只發送封包給客戶端，不觸發鄰居更新（效能最高）。
     * flags=3 觸發鄰居更新 + 發送封包（物理效果正確但較慢）。
     */
    public void commit(int flags) {
        for (Map.Entry<BlockPos, BlockState> entry : pending.entrySet()) {
            level.setBlock(entry.getKey(), entry.getValue(), flags);
        }
        pending.clear();
    }

    /** 清除所有排隊的修改。 */
    public void clear() {
        pending.clear();
    }

    public int pendingCount() {
        return pending.size();
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── world/
    ├── ChunkAccessUtil.java
    └── BulkBlockEditor.java
```

## 執行緒安全注意事項 / Thread Safety

- ⚠️ 所有 Chunk/Block 讀寫操作**必須在主執行緒呼叫**
- ⚠️ `BulkBlockEditor.commit()` 亦需在主執行緒呼叫
- ✅ 唯讀操作（`getBlockState`、`getHeight`）在不修改世界的前提下可在 async 讀取，但 Paper 不保證一致性
- ⚠️ 批次大量方塊修改可能造成 TPS 下降，建議每 tick 分批處理（每 tick ≤ 500 格）
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `getChunk()` 回傳未載入狀態 | 區塊未完全生成 | 呼叫前先 `world.loadChunk(cx, cz)` 確保載入 |
| `ArrayIndexOutOfBoundsException` | sectionY 超出範圍 | 確認 sectionY 在 `chunk.getMinSection()` 至 `getMaxSection()` 之間 |
| 方塊更新後客戶端無反應 | flags=0 或未呼叫 `commit()` | 改用 flags=2（`SEND_TO_CLIENTS`） |
| 大量更新造成伺服器卡頓 | 單 tick 修改過多方塊 | 分批執行（Bukkit scheduler runTaskTimer） |
