
# Paper Disposable World

## Purpose

Minigames and duels need throwaway worlds, or arenas that are restored after every match. Two routes are provided: "swap the world" and "restore in place"; world operations always run on the main thread, and only file IO (copy, delete) is async.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (compile-verified on both)
- Pure Paper API, no Paperweight needed
- The old GameRule constants are deprecated; the templates instead look rules up by snake_case key in `Registry.GAME_RULE` (identical on both versions)

---

## Generated Code

### VoidChunkGenerator.java

```java
public final class VoidChunkGenerator extends ChunkGenerator {
    @Override public boolean shouldGenerateNoise() { return false; }
    @Override public boolean shouldGenerateSurface() { return false; }
    // ... Bedrock / Caves / Decorations / Mobs / Structures likewise return false
    @Override
    public Location getFixedSpawnLocation(World world, Random random) {
        return new Location(world, 0.5, 64.0, 0.5);
    }
}
```

### Creation and guard (DisposableWorlds)

```java
// Refuse if the folder already exists: WorldCreator silently generates terrain for a broken folder as if it were a new world
World world = WorldCreator.name(name)
        .generator(generator)
        .generateStructures(false)
        .keepSpawnLoaded(TriState.FALSE)
        .createWorld();
rules.apply(world);   // Apply game rules immediately after creation
```

### Template copy and deletion (WorldFolders, async)

```java
// Copy: skip uid.dat and session.lock; write level.dat last
// Delete: delete level.dat last, so a half-deleted folder is never mistaken for a world
WorldFolders.copyTemplate(template, target);
WorldFolders.deleteWorld(folder);
```

### In-place restore (ChangeRecorder + ArenaResetService)

```java
// Record each cell's BlockData before its first change; restoring is limited per tick by block count and a time budget
cells.putIfAbsent(block.getBlockKey(), block.getBlockData());
block.setBlockData(original, false);
sweeper.sweepAll(world);   // Leftover entities: dropped items, arrows, TNT minecarts, crystals, etc.
```

---

## Thread Safety

- World creation / unloading and block and entity operations run on the main thread only
- Only the copy and delete in `WorldFolders` are async; lambdas carry only `Path` / `String`
- Returned futures always complete on the main thread; `onDisable` finishes synchronously with `closeAllSync()`
- For the NMS fast path for large block counts (hundreds of thousands of cells), see `nms-chunk-access`
