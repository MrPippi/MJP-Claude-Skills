# NMS Chunk Access

## Purpose

Read and write block states and heightmaps directly through NMS `LevelChunk`, `ChunkAccess`, and `LevelChunkSection`, bypassing the per-block overhead of Bukkit `Chunk.getBlock()`, for high-performance bulk block operations (such as structure generation and map scanning).

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### ChunkAccessUtil.java

```java
// Get the NMS BlockState at the given coordinates (does not trigger a lighting update)
BlockState state = ChunkAccessUtil.getBlockState(location);

// Set the BlockState directly (bypasses Bukkit events; flags 3 = update neighbors + sync client)
ChunkAccessUtil.setBlockState(location, Blocks.STONE.defaultBlockState(), 3);

// Read the WORLD_SURFACE heightmap
int surfaceY = ChunkAccessUtil.getSurfaceHeight(chunk, x, z);
```

### BulkBlockEditor.java (batch operations)

```java
BulkBlockEditor editor = new BulkBlockEditor(world);

// Batch-fill blocks (minimizes client updates)
editor.fill(0, 64, 0, 15, 70, 15, Blocks.GLASS.defaultBlockState())
      .set(8, 71, 8, Blocks.GLOWSTONE.defaultBlockState());

int count = editor.pendingCount();  // Get the number of pending changes
editor.commit(3);                   // Push all at once (flags 3 = update neighbors + sync client)
```

---

## Thread Safety

- All operations of `ChunkAccessUtil` and `BulkBlockEditor` **must be called on the main thread**
- Reading from a chunk that is not loaded triggers a synchronous load, which may cause a brief stall
