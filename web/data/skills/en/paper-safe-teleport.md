# Paper Safe Teleport

## Purpose

Implement teleportation that never drops a player into lava, the void or a wall: random teleport, landing-spot checks before teleporting home, warm-up and cooldown. Call `getChunkAtAsync` first and evaluate on the main thread once the future completes; after `teleportAsync` completes, return to the main thread to finish up, re-validating after every async stage.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both compile-verified)
- Pure Paper API, no Paperweight needed
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### SafeLocationRules.java (stateless checks)

```java
import java.util.Set;
import org.bukkit.Material;
import org.bukkit.Tag;
import org.bukkit.World;
import org.bukkit.block.Block;

public static boolean safeColumn(World world, Set<Material> hazards, int x, int y, int z) {
    Block floor = world.getBlockAt(x, y, z);
    Material floorType = floor.getType();
    if (!floorType.isSolid() || floor.isLiquid() || hazards.contains(floorType) || Tag.LEAVES.isTagged(floorType)) {
        return false;
    }
    for (int i = 1; i <= 3; i++) {   // clearance for feet, head, above head
        Block above = world.getBlockAt(x, y + i, z);
        if (!above.isPassable() || above.isLiquid() || hazards.contains(above.getType())) {
            return false;
        }
    }
    return true;
}
```

### SafeSpotFinder.java (bounded async search)

```java
// the world.getChunkAtAsync future completes on the main thread, so reading blocks is safe
return world.getChunkAtAsync(x >> 4, z >> 4)
    .handle((chunk, err) -> err != null || chunk == null
        ? Optional.<Location>empty()
        : SafeLocationRules.evaluate(world, x, z))
    .thenCompose(found -> found.isPresent()
        ? CompletableFuture.completedFuture(found)
        : attempt(world, minR, maxR, max, n + 1));
```

### SafeTeleportService.java (teleport and wrap-up)

```java
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent.TeleportCause;
import org.bukkit.plugin.Plugin;

public static void teleport(Plugin plugin, Player player, Location verified) {
    player.teleportAsync(verified, TeleportCause.PLUGIN)
        .whenComplete((ok, err) -> plugin.getServer().getScheduler().runTask(plugin, () -> {
            // back on the main thread, re-fetch the player; record the cooldown only on success
        }));
}
```

---

## Rules

- Solid, non-hazardous block underfoot; the feet, head and above-head cells must each be passable and neither liquid nor a hazard block
- Overworld uses `HeightMap.MOTION_BLOCKING_NO_LEAVES`; the Nether (`hasCeiling()`) searches downward for a floor starting at `logicalHeight - 8`
- The landing spot must satisfy `WorldBorder#isInside`; the search has an attempt limit, and failure sends the player a message
- Cooldowns are keyed by UUID and store a timestamp, recorded only after a successful teleport
- Teleporting is forbidden during combat: plug `paper-combat-tag` in through `TeleportGuard`, checking before warm-up starts, after the search completes and before teleporting

---

## Thread Safety

- Between async stages carry only the UUID; after returning, re-fetch `Player` / `World` and re-validate (online, gate, world unchanged)
- Reading blocks, `WorldBorder` and chunk tickets always happen on the main thread
- The landing-spot pool is single-use: remove from the pool first, then re-verify, so the same tick never hands one spot to two players
