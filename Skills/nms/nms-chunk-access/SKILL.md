---
name: nms-chunk-access
description: "透過 NMS LevelChunk 直接讀寫方塊、高度圖、ChunkSection 資料，比 Bukkit Chunk API 更快更底層（Paper NMS + Mojang-mapped）/ Direct LevelChunk block, heightmap, and ChunkSection access for high-performance operations"
---

# NMS Chunk Access

## Skill Name

`nms-chunk-access`

## Purpose

Read and write block states and heightmaps directly through NMS `LevelChunk`, `ChunkAccess`, and `LevelChunkSection`. This bypasses the per-block overhead of Bukkit `Chunk.getBlock()` and enables high-performance large-scale block operations (such as structure generation and map scanning).

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- "chunk access", "LevelChunk", "區塊操作", "chunk data", "直接讀寫方塊"
- "ChunkSection", "heightmap", "高度圖", "chunk NMS", "bulk block"
- "大量方塊", "高效能方塊操作", "structure paste"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.world` | Package of the generated classes |
| `class_name` | `ChunkAccessUtil` | Utility class name |

## Outputs

- `ChunkAccessUtil.java` — LevelChunk read/write utility
- `BulkBlockEditor.java` — bulk block operations (minimizes client updates)

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

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
import org.bukkit.craftbukkit.CraftChunk;
import org.bukkit.craftbukkit.CraftWorld;

@SuppressWarnings("UnstableApiUsage")
public final class ChunkAccessUtil {

    private ChunkAccessUtil() {}

    /** Gets the NMS LevelChunk (CraftChunk.getHandle(ChunkStatus) returns a ChunkAccess, not a LevelChunk). */
    public static LevelChunk getChunk(Chunk chunk) {
        return ((CraftWorld) chunk.getWorld()).getHandle().getChunk(chunk.getX(), chunk.getZ());
    }

    /** Gets the NMS BlockState at the given world position (does not trigger a light update). */
    public static BlockState getBlockState(Location loc) {
        net.minecraft.world.level.Level level = ((CraftWorld) loc.getWorld()).getHandle();
        BlockPos pos = new BlockPos(loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        return level.getChunk(pos).getBlockState(pos);
    }

    /**
     * Sets the block state directly (skips some Bukkit handling, so it is faster).
     * flags: 1=update neighbors, 2=send to clients, 3=both
     * Must be called on the main thread.
     */
    public static void setBlockState(Location loc, BlockState state, int flags) {
        net.minecraft.world.level.Level level = ((CraftWorld) loc.getWorld()).getHandle();
        BlockPos pos = new BlockPos(loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        level.setBlock(pos, state, flags);
    }

    /** Gets the surface height at the given X/Z (WORLD_SURFACE heightmap). */
    public static int getSurfaceHeight(World world, int x, int z) {
        net.minecraft.world.level.Level level = ((CraftWorld) world).getHandle();
        BlockPos pos = new BlockPos(x, 0, z);
        LevelChunk chunk = level.getChunkAt(pos);
        return chunk.getHeight(Heightmap.Types.WORLD_SURFACE, x & 15, z & 15);
    }

    /** Gets the motion-blocking height at the given X/Z (MOTION_BLOCKING, includes water). */
    public static int getMotionBlockingHeight(World world, int x, int z) {
        net.minecraft.world.level.Level level = ((CraftWorld) world).getHandle();
        BlockPos pos = new BlockPos(x, 0, z);
        LevelChunk chunk = level.getChunkAt(pos);
        return chunk.getHeight(Heightmap.Types.MOTION_BLOCKING, x & 15, z & 15);
    }

    /** Gets a ChunkSection (a 16-block-tall sub-section); sectionY is the section Y coordinate (not a block Y). */
    public static LevelChunkSection getSection(Chunk chunk, int sectionY) {
        LevelChunk nms = getChunk(chunk);
        return nms.getSections()[nms.getSectionIndexFromSectionY(sectionY)];
    }

    /** Reads a block state inside a ChunkSection (localX/Y/Z are relative coordinates 0-15). */
    public static BlockState getSectionBlockState(
            LevelChunkSection section, int localX, int localY, int localZ) {
        return section.getBlockState(localX, localY, localZ);
    }

    /** Gets the light level at the given position (SKY or BLOCK). */
    public static int getLightLevel(Location loc, LightLayer layer) {
        net.minecraft.world.level.Level level = ((CraftWorld) loc.getWorld()).getHandle();
        BlockPos pos = new BlockPos(loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        return level.getBrightness(layer, pos);
    }
}
```

### `BulkBlockEditor.java` (bulk block operations)

```java
package com.example.world;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.LevelChunk;
import org.bukkit.World;
import org.bukkit.craftbukkit.CraftWorld;

import java.util.HashMap;
import java.util.Map;

/**
 * Bulk block operation utility.
 * Collects all changes and commits them at once to reduce the number of client update packets.
 * Must be used on the main thread.
 */
@SuppressWarnings("UnstableApiUsage")
public class BulkBlockEditor {

    private final net.minecraft.world.level.Level level;
    private final Map<BlockPos, BlockState> pending = new HashMap<>();

    public BulkBlockEditor(World world) {
        this.level = ((CraftWorld) world).getHandle();
    }

    /** Queues a single block change. */
    public BulkBlockEditor set(int x, int y, int z, BlockState state) {
        pending.put(new BlockPos(x, y, z), state);
        return this;
    }

    /** Queues a fill of a cuboid region (minX..maxX, minY..maxY, minZ..maxZ). */
    public BulkBlockEditor fill(int x1, int y1, int z1, int x2, int y2, int z2, BlockState state) {
        for (int x = x1; x <= x2; x++)
            for (int y = y1; y <= y2; y++)
                for (int z = z1; z <= z2; z++)
                    pending.put(new BlockPos(x, y, z), state);
        return this;
    }

    /**
     * Commits all changes.
     * flags=2 only sends packets to clients without triggering neighbor updates (fastest).
     * flags=3 triggers neighbor updates and sends packets (correct physics but slower).
     */
    public void commit(int flags) {
        for (Map.Entry<BlockPos, BlockState> entry : pending.entrySet()) {
            level.setBlock(entry.getKey(), entry.getValue(), flags);
        }
        pending.clear();
    }

    /** Clears all queued changes. */
    public void clear() {
        pending.clear();
    }

    public int pendingCount() {
        return pending.size();
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── world/
    ├── ChunkAccessUtil.java
    └── BulkBlockEditor.java
```

## Thread Safety

- ⚠️ All Chunk/Block read/write operations **must be called on the main thread**
- ⚠️ `BulkBlockEditor.commit()` must also be called on the main thread
- ✅ Read-only operations (`getBlockState`, `getHeight`) can be read async as long as the world is not modified, but Paper does not guarantee consistency
- ⚠️ Bulk block changes can lower TPS; process them in batches per tick (at most 500 blocks per tick)
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| `getChunk()` returns an unloaded state | Chunk is not fully generated | Call `world.loadChunk(cx, cz)` first to ensure it is loaded |
| `ArrayIndexOutOfBoundsException` | sectionY out of range | Convert with `chunk.getSectionIndexFromSectionY(sectionY)` and confirm the result is between `0` and `getSectionsCount() - 1` |
| Client does not react after a block update | flags=0 or `commit()` was not called | Use flags=2 (`SEND_TO_CLIENTS`) |
| Large updates lag the server | Too many blocks changed in a single tick | Run in batches (Bukkit scheduler runTaskTimer) |
