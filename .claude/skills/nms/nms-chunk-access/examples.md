# examples — nms-chunk-access

## 範例 1：讀取地面高度（掃描地形）

**Input:**
```
package_name: com.example.world
```

**Output — 找出範圍內最高地面點:**
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

## 範例 2：批次填充地下空洞

**Input:**
```
package_name: com.example.world
```

**Output — 將指定範圍的 AIR 方塊填充為 STONE（主執行緒）:**
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
    editor.commit(3); // flags=3: 觸發鄰居更新 + 發送封包
    player.sendMessage("§a已填充 " + filled + " 個空洞");
}
```

---

## 範例 3：高效平原填充（無觸發事件）

**Input:**
```
package_name: com.example.world
```

**Output — 快速填充 32×32 平面為草地（flags=2 只發封包，不觸發物理）:**
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
            // 清除上方的方塊
            editor.set(absX, baseY + 1, absZ, Blocks.AIR.defaultBlockState());
        }
    }

    editor.commit(2); // 只發客戶端封包，不觸發 BlockPhysics
    player.sendMessage("§a已平整 " + (radius * 2 + 1) + "² 範圍");
}
```

---

## 範例 4：讀取 ChunkSection 掃描礦石

**Input:**
```
package_name: com.example.world
```

**Output — 掃描區塊 Section 尋找鑽石礦:**
```java
public List<Location> findDiamonds(Chunk chunk) {
    List<Location> result = new ArrayList<>();
    LevelChunk nms = ChunkAccessUtil.getChunk(chunk);

    // 鑽石礦在 Y -64 到 Y 16（section -4 到 1）
    for (int sectionY = nms.getMinSection(); sectionY < nms.getMaxSection(); sectionY++) {
        LevelChunkSection section = nms.getSections()[sectionY - nms.getMinSection()];
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
