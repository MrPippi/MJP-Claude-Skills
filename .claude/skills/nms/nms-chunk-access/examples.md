# examples — nms-chunk-access

## Example 1: Read surface height (terrain scan)

**Input:**
```
package_name: com.example.world
```

**Output — find the highest surface point in range:**
```java
public Location findHighestPoint(World world, int centerX, int centerZ, int radius) {
    int highestY = Integer.MIN_VALUE;
    int bestX = centerX, bestZ = centerZ;

    for (int x = centerX - radius; x <= centerX + radius; x++) {
        for (int z = centerZ - radius; z <= centerZ + radius; z++) {
            int y = ChunkAccessUtil.getSurfaceHeight(world, x, z);
            if (y > highestY) {
                highestY = y;
                bestX = x;
                bestZ = z;
            }
        }
    }
    return new Location(world, bestX, highestY, bestZ);
}
```

---

## Example 2: Bulk-fill underground cavities

**Input:**
```
package_name: com.example.world
```

**Output — fill AIR blocks in the given range with STONE (main thread):**
```java
public void fillCave(World world, int x1, int y1, int z1,
                     int x2, int y2, int z2) {
    BulkBlockEditor editor = new BulkBlockEditor(world);
    BlockState stone = Blocks.STONE.defaultBlockState();

    for (int x = x1; x <= x2; x++)
        for (int y = y1; y <= y2; y++)
            for (int z = z1; z <= z2; z++) {
                Location loc = new Location(world, x, y, z);
                BlockState current = ChunkAccessUtil.getBlockState(loc);
                if (current.isAir()) {
                    editor.set(x, y, z, stone);
                }
            }

    int filled = editor.pendingCount();
    editor.commit(3); // flags=3: trigger neighbor updates + send packets
    player.sendMessage("§aFilled " + filled + " cavity blocks");
}
```

---

## Example 3: Efficient flat-area fill (no events triggered)

**Input:**
```
package_name: com.example.world
```

**Output — quickly fill a 32x32 plane with grass (flags=2 only sends packets, no physics):**
```java
public void flattenArea(Player player, int radius) {
    Location origin = player.getLocation();
    int baseY = origin.getBlockY() - 1;
    World world = origin.getWorld();

    BulkBlockEditor editor = new BulkBlockEditor(world);
    BlockState grass = Blocks.GRASS_BLOCK.defaultBlockState();

    for (int x = -radius; x <= radius; x++) {
        for (int z = -radius; z <= radius; z++) {
            int absX = origin.getBlockX() + x;
            int absZ = origin.getBlockZ() + z;
            editor.set(absX, baseY, absZ, grass);
            // Clear the block above
            editor.set(absX, baseY + 1, absZ, Blocks.AIR.defaultBlockState());
        }
    }

    editor.commit(2); // Only send client packets, do not trigger BlockPhysics
    player.sendMessage("§aFlattened a " + (radius * 2 + 1) + "² area");
}
```

---

## Example 4: Scan ore through ChunkSection

**Input:**
```
package_name: com.example.world
```

**Output — scan chunk sections for diamond ore:**
```java
public List<Location> findDiamonds(Chunk chunk) {
    List<Location> result = new ArrayList<>();
    LevelChunk nms = ChunkAccessUtil.getChunk(chunk);

    // Diamond ore spawns from Y -64 to Y 16 (sections -4 to 1)
    // In 1.21.2+ getMinSection() was renamed to getMinSectionY(); an index loop works on both 1.21-1.21.3
    for (int index = 0; index < nms.getSectionsCount(); index++) {
        int sectionY = nms.getSectionYFromSectionIndex(index);
        LevelChunkSection section = nms.getSections()[index];
        if (section == null || section.hasOnlyAir()) continue;

        for (int lx = 0; lx < 16; lx++) {
            for (int ly = 0; ly < 16; ly++) {
                for (int lz = 0; lz < 16; lz++) {
                    BlockState state = section.getBlockState(lx, ly, lz);
                    if (state.is(Blocks.DIAMOND_ORE) || state.is(Blocks.DEEPSLATE_DIAMOND_ORE)) {
                        int worldY = sectionY * 16 + ly;
                        result.add(new Location(chunk.getWorld(),
                            chunk.getX() * 16 + lx, worldY, chunk.getZ() * 16 + lz));
                    }
                }
            }
        }
    }
    return result;
}
```
