---
name: paper-safe-teleport
description: "安全隨機傳送（RTP）與安全落點傳送：getChunkAtAsync 後在主執行緒判定、teleportAsync 完成後重新驗證、暖機移動取消與冷卻、預找落點池 / Safe random teleport and safe-location teleports on Paper with async chunk loading, re-validation, warmup, cooldowns and a spot pool"
---

# Paper Safe Teleport

## Skill Name

`paper-safe-teleport`

## Purpose

Implement teleports that never drop a player into lava, the void, or a wall: random teleport (RTP), landing-spot checks before teleporting to player-set points (homes, waypoints), plus warmup (stand still for N seconds) and cooldown.

Core approach:
- Use `World#getChunkAtAsync` first so Paper loads/generates chunks in the background; read blocks and judge safety only after the future completes on the **main thread**
- Keep the safety rules in one stateless class shared by RTP, homes, and paired teleports
- Cap the number of search attempts; if nothing is found, reply to the player instead of retrying forever
- Finish on the main thread after `Player#teleportAsync` completes; **re-validate** after every async stage (player online, not in combat, world unchanged)
- Optional pre-found spot pool: refill step by step, re-validate on take and invalidate immediately, so two players never land on the same spot in one tick

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (templates are compile-verified on both, no differences)
- Pure Paper API, no Paperweight required
- Uses only `World`, `WorldBorder`, `HeightMap`, `Player#teleportAsync`, `BukkitScheduler`

## Triggers

- "隨機傳送", "RTP", "random teleport", "/rtp", "wild"
- "安全傳送", "safe teleport", "安全落點", "safe location"
- "傳送暖機", "warmup", "冷卻", "teleport cooldown"
- "teleportAsync", "getChunkAtAsync", "落點池", "spot pool"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `base_package` | `com.example.teleport` | Package of the generated classes |
| `world` | `world` | RTP target world |
| `min_radius` / `max_radius` | `500` / `5000` | Ring range around the world spawn (blocks) |
| `max_attempts` | `12` | Maximum random points tried per search |
| `warmup_ticks` | `100` | Warmup time (0 = no warmup) |
| `cooldown` | `PT5M` | Cooldown (ISO-8601 Duration) |
| `pool_size` | `4` | Pre-found spot pool capacity (0 = disabled) |

## Outputs

- `SafeLocationRules.java` — stateless safety checks (landing rules, Nether ceiling, world border)
- `SafeSpotFinder.java` — async spot search with an attempt cap
- `SafeSpotPool.java` — pre-found spot pool (step-wise refill, single-use take, chunk tickets)
- `TeleportGuard.java` — pre-teleport gate (combat status, etc.) that returns a denial reason
- `TeleportCooldowns.java` — cooldowns keyed by UUID and stored as timestamps
- `TeleportSettings.java` — immutable config
- `SafeTeleportService.java` — warmup -> search -> re-validate -> `teleportAsync` -> finish
- `WarmupListener.java` — cancel on movement and cleanup on quit

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). Only `paper-api` (`compileOnly`) is required. Combat tagging is provided by [`paper-combat-tag`](../paper-combat-tag/SKILL.md); this skill integrates with it only through the `TeleportGuard` interface and has no compile-time dependency on it.

## Safe Location Rules

| Item | Rule |
|------|------|
| Floor block | Solid, not a liquid, not on the hazard list, not leaves |
| Body space | Feet (y+1) and head (y+2) are both passable and not liquid |
| Headroom | The block above (y+3) must also be passable, to avoid bumping the head when jumping or getting stuck |
| Hazard blocks | Lava, water, fire, campfires, magma blocks, powder snow, cactus, sweet berry bushes, pointed dripstone, wither roses, cobwebs, portals |
| Heightmap | Overworld-like worlds use `HeightMap.MOTION_BLOCKING_NO_LEAVES`, so players never land on tree canopies |
| Void | A highest block at the world's minimum height (no ground) counts as a failure |
| World border | The spot must satisfy `WorldBorder#isInside` |
| Nether | In a `World#hasCeiling()` world (the Nether) the highest block is the bedrock roof (y about 123-127), so scan down for a floor starting at `logicalHeight - 8` (120); the head never touches the bedrock layer and players never land on the roof at y >= 127 |

## Code Template

### `SafeLocationRules.java`

```java
package com.example.teleport;

import org.bukkit.HeightMap;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Tag;
import org.bukkit.World;
import org.bukkit.block.Block;

import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;

/**
 * Stateless safe-location checks. <b>Call only on the main thread and only when the chunk is loaded</b>
 * (call {@code getChunkAtAsync} first, then come here after the future completes).
 */
public final class SafeLocationRules {

    /** Feet (y+1), head (y+2), headroom (y+3). */
    private static final int HEADROOM = 3;
    /** The Nether bedrock roof sits at logicalHeight-5 to -1; the highest floor is logicalHeight-8, so the three blocks above stay below the bedrock layer. */
    private static final int CEILING_CLEARANCE = 8;
    private static final int CHUNK_SHIFT = 4;
    private static final double CENTER_OFFSET = 0.5;

    private static final Set<Material> HAZARDS = Set.of(
        Material.LAVA, Material.WATER, Material.FIRE, Material.SOUL_FIRE,
        Material.CAMPFIRE, Material.SOUL_CAMPFIRE, Material.MAGMA_BLOCK,
        Material.POWDER_SNOW, Material.CACTUS, Material.SWEET_BERRY_BUSH,
        Material.POINTED_DRIPSTONE, Material.WITHER_ROSE, Material.COBWEB,
        Material.BUBBLE_COLUMN, Material.NETHER_PORTAL, Material.END_PORTAL);

    private SafeLocationRules() {}

    /** Finds a safe landing spot in the (x, z) column; returns the feet position (block center). Returns empty if the chunk is not loaded, the spot is unsafe, or it is outside the border. */
    public static Optional<Location> evaluate(World world, int x, int z) {
        if (!world.isChunkLoaded(x >> CHUNK_SHIFT, z >> CHUNK_SHIFT)) {
            return Optional.empty();
        }
        OptionalInt floorY = world.hasCeiling() ? scanBelowCeiling(world, x, z) : surfaceFloor(world, x, z);
        if (floorY.isEmpty()) {
            return Optional.empty();
        }
        Location feet = new Location(world, x + CENTER_OFFSET, floorY.getAsInt() + 1, z + CENTER_OFFSET);
        return world.getWorldBorder().isInside(feet) ? Optional.of(feet) : Optional.empty();
    }

    /** Finds the nearest safe landing spot around center, from near to far (square rings); only looks at loaded chunks. */
    public static Optional<Location> findNearby(World world, Location center, int radius) {
        int cx = center.getBlockX();
        int cz = center.getBlockZ();
        for (int r = 0; r <= radius; r++) {
            for (int dx = -r; dx <= r; dx++) {
                for (int dz = -r; dz <= r; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) != r) continue;
                    Optional<Location> found = evaluate(world, cx + dx, cz + dz);
                    if (found.isPresent()) return found;
                }
            }
        }
        return Optional.empty();
    }

    private static OptionalInt surfaceFloor(World world, int x, int z) {
        int y = world.getHighestBlockAt(x, z, HeightMap.MOTION_BLOCKING_NO_LEAVES).getY();
        if (y <= world.getMinHeight() || y + HEADROOM >= world.getMaxHeight()) {
            return OptionalInt.empty(); // Void or at the world height limit
        }
        return safeColumn(world, x, y, z) ? OptionalInt.of(y) : OptionalInt.empty();
    }

    private static OptionalInt scanBelowCeiling(World world, int x, int z) {
        int top = Math.min(world.getLogicalHeight() - CEILING_CLEARANCE, world.getMaxHeight() - HEADROOM - 1);
        for (int y = top; y > world.getMinHeight(); y--) {
            if (safeColumn(world, x, y, z)) {
                return OptionalInt.of(y);
            }
        }
        return OptionalInt.empty();
    }

    private static boolean safeColumn(World world, int x, int y, int z) {
        Block floor = world.getBlockAt(x, y, z);
        Material floorType = floor.getType();
        if (!floorType.isSolid() || floor.isLiquid() || HAZARDS.contains(floorType) || Tag.LEAVES.isTagged(floorType)) {
            return false;
        }
        for (int i = 1; i <= HEADROOM; i++) {
            Block above = world.getBlockAt(x, y + i, z);
            // Passable does not mean safe: FIRE and SWEET_BERRY_BUSH have no collision box, so check the hazard list separately
            if (!above.isPassable() || above.isLiquid() || HAZARDS.contains(above.getType())) {
                return false;
            }
        }
        return true;
    }
}
```

### `SafeSpotFinder.java`

```java
package com.example.teleport;

import org.bukkit.Location;
import org.bukkit.World;

import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.random.RandomGenerator;

/**
 * Async spot search with an attempt cap: random (x, z) -> {@code getChunkAtAsync} (future completes on the main thread) -> check on the main thread.
 * Stateless; the random source is injected (tests can supply a fixed seed).
 */
public final class SafeSpotFinder {

    private static final int CHUNK_SHIFT = 4;

    private final RandomGenerator rng;

    public SafeSpotFinder(RandomGenerator rng) {
        this.rng = rng;
    }

    /** Searches the ring [minRadius, maxRadius] around spawn; returns empty after maxAttempts attempts (the future never completes exceptionally). */
    public CompletableFuture<Optional<Location>> find(World world, int minRadius, int maxRadius, int maxAttempts) {
        return attempt(world, minRadius, maxRadius, maxAttempts, 0);
    }

    private CompletableFuture<Optional<Location>> attempt(World world, int minR, int maxR, int max, int n) {
        if (n >= max) {
            return CompletableFuture.completedFuture(Optional.empty());
        }
        Location spawn = world.getSpawnLocation();
        double angle = rng.nextDouble(0, Math.PI * 2);
        double dist = rng.nextDouble(minR, Math.max(minR + 1, maxR));
        int x = spawn.getBlockX() + (int) Math.round(Math.cos(angle) * dist);
        int z = spawn.getBlockZ() + (int) Math.round(Math.sin(angle) * dist);

        return world.getChunkAtAsync(x >> CHUNK_SHIFT, z >> CHUNK_SHIFT)
            .handle((chunk, err) -> {
                if (err != null || chunk == null) {
                    return Optional.<Location>empty();
                }
                return SafeLocationRules.evaluate(world, x, z); // Already on the main thread here
            })
            .thenCompose(found -> found.isPresent()
                ? CompletableFuture.completedFuture(found)
                : attempt(world, minR, maxR, max, n + 1));
    }
}
```

### `TeleportGuard.java`

```java
package com.example.teleport;

import org.bukkit.entity.Player;

import java.util.Optional;
import java.util.UUID;

/**
 * Pre-teleport gate: returns a denial reason (MiniMessage string); empty means allowed.
 * Checked before warmup starts, after the search completes, and before {@code teleportAsync}, since a combat tag can appear during warmup.
 */
@FunctionalInterface
public interface TeleportGuard {

    Optional<String> denyReason(Player player);

    /** Combat status source; implemented by the paper-combat-tag service (see that skill). */
    @FunctionalInterface
    interface CombatStatus {
        boolean isTagged(UUID playerId);
    }

    static TeleportGuard allowAll() {
        return player -> Optional.empty();
    }

    /** Blocks teleporting while in combat. */
    static TeleportGuard blockWhileTagged(CombatStatus status) {
        return player -> status.isTagged(player.getUniqueId())
            ? Optional.of("<red>You cannot teleport while in combat.")
            : Optional.empty();
    }

    /** Applies in order; the first denial reason wins. */
    default TeleportGuard and(TeleportGuard other) {
        return player -> {
            Optional<String> mine = denyReason(player);
            return mine.isPresent() ? mine : other.denyReason(player);
        };
    }
}
```

### `TeleportCooldowns.java`

```java
package com.example.teleport;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cooldown: keyed by UUID, stores the timestamp of the last successful teleport (epoch millis).
 * Storing a timestamp instead of a countdown means it can be restored after a restart and needs no per-tick decrement. The Clock is injected for testing.
 */
public final class TeleportCooldowns {

    private final Clock clock;
    private final Map<UUID, Long> lastUsedMillis;

    public TeleportCooldowns(Clock clock, Map<UUID, Long> restored) {
        this.clock = clock;
        this.lastUsedMillis = new ConcurrentHashMap<>(restored);
    }

    /** Remaining cooldown; returns {@link Duration#ZERO} if it has ended or there is no record. */
    public Duration remaining(UUID playerId, Duration cooldown) {
        Long last = lastUsedMillis.get(playerId);
        if (last == null) return Duration.ZERO;
        Duration left = cooldown.minusMillis(clock.millis() - last);
        return left.isNegative() ? Duration.ZERO : left;
    }

    /** Call only after a successful teleport; a failure must not consume the player's cooldown. */
    public void mark(UUID playerId) {
        lastUsedMillis.put(playerId, clock.millis());
    }

    /** Immutable snapshot for persistence (e.g. writing to a file in onDisable). */
    public Map<UUID, Long> snapshot() {
        return Map.copyOf(lastUsedMillis);
    }
}
```

### `TeleportSettings.java`

```java
package com.example.teleport;

import java.time.Duration;

/** Immutable config; invalid values fail immediately at construction. */
public record TeleportSettings(
    int warmupTicks,
    Duration cooldown,
    int minRadius,
    int maxRadius,
    int maxAttempts,
    double moveToleranceBlocks
) {
    public TeleportSettings {
        if (warmupTicks < 0) throw new IllegalArgumentException("warmupTicks must be >= 0");
        if (cooldown.isNegative()) throw new IllegalArgumentException("cooldown must be >= 0");
        if (minRadius < 0 || maxRadius <= minRadius) throw new IllegalArgumentException("need 0 <= minRadius < maxRadius");
        if (maxAttempts < 1) throw new IllegalArgumentException("maxAttempts must be >= 1");
        if (moveToleranceBlocks < 0) throw new IllegalArgumentException("moveToleranceBlocks must be >= 0");
    }
}
```

### `SafeSpotPool.java`

```java
package com.example.teleport;

import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.plugin.Plugin;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Optional;
import java.util.UUID;

/**
 * Pre-found spot pool for a single world; use on the main thread only.
 *
 * <ul>
 *   <li>Step-wise refill: run only one search at a time and wait {@code STEP_DELAY_TICKS} after it completes before the next, so the tick budget is never used up at once</li>
 *   <li>Single use: {@link #take} removes the spot from the pool before re-validating, so the same spot can never be given to two players (not even in the same tick)</li>
 *   <li>Each pooled spot's chunk holds a plugin chunk ticket, so the chunk is always loaded on take and re-validation never reads from disk; the ticket is released on the next tick after the spot is taken</li>
 *   <li>Generation counter: search results that return after {@link #close} are discarded</li>
 * </ul>
 */
public final class SafeSpotPool {

    private static final long STEP_DELAY_TICKS = 20L;
    private static final long RETRY_DELAY_TICKS = 200L;
    private static final int CHUNK_SHIFT = 4;

    private record PooledSpot(int x, int z) {
        int chunkX() { return x >> CHUNK_SHIFT; }
        int chunkZ() { return z >> CHUNK_SHIFT; }
    }

    private final Plugin plugin;
    private final SafeSpotFinder finder;
    private final UUID worldId;
    private final TeleportSettings settings;
    private final int capacity;
    private final Deque<PooledSpot> spots = new ArrayDeque<>();
    private boolean refilling;
    private boolean closed;
    private long generation;

    public SafeSpotPool(Plugin plugin, SafeSpotFinder finder, UUID worldId, TeleportSettings settings, int capacity) {
        this.plugin = plugin;
        this.finder = finder;
        this.worldId = worldId;
        this.settings = settings;
        this.capacity = Math.max(0, capacity);
    }

    /** A pool with capacity 0: never yields a spot and never refills; used for "no pool". */
    public static SafeSpotPool disabled(Plugin plugin, SafeSpotFinder finder, TeleportSettings settings) {
        return new SafeSpotPool(plugin, finder, new UUID(0L, 0L), settings, 0);
    }

    public void start() {
        refill();
    }

    /** Takes a re-validated spot; returns empty if the pool is empty or every spot is stale. Triggers a refill either way. */
    public Optional<Location> take(World world) {
        requireMainThread();
        Optional<Location> result = Optional.empty();
        if (!closed && world.getUID().equals(worldId)) {
            while (result.isEmpty() && !spots.isEmpty()) {
                PooledSpot spot = spots.pollFirst();   // Remove from the pool first -> single use
                releaseNextTick(spot);
                result = SafeLocationRules.evaluate(world, spot.x(), spot.z()); // The terrain may have been rebuilt
            }
        }
        refill();
        return result;
    }

    public void close() {
        requireMainThread();
        closed = true;
        generation++;
        spots.clear();
        World world = plugin.getServer().getWorld(worldId);
        if (world != null) {
            world.removePluginChunkTickets(plugin);
        }
    }

    private void refill() {
        World world = plugin.getServer().getWorld(worldId);
        if (closed || refilling || world == null || spots.size() >= capacity) {
            return;
        }
        refilling = true;
        long g = generation;
        finder.find(world, settings.minRadius(), settings.maxRadius(), settings.maxAttempts())
            .whenComplete((found, err) -> onMain(() -> onFound(g, found, err)));
    }

    private void onFound(long g, Optional<Location> found, Throwable err) {
        if (closed || g != generation) return;
        refilling = false;
        World world = plugin.getServer().getWorld(worldId);
        boolean added = false;
        if (err == null && found != null && found.isPresent() && world != null) {
            PooledSpot spot = new PooledSpot(found.get().getBlockX(), found.get().getBlockZ());
            if (!holdsChunk(spot.chunkX(), spot.chunkZ())) { // Do not store two spots in the same chunk, so two players do not land together
                world.addPluginChunkTicket(spot.chunkX(), spot.chunkZ(), plugin);
                spots.addLast(spot);
                added = true;
            }
        }
        scheduleNext(added ? STEP_DELAY_TICKS : RETRY_DELAY_TICKS);
    }

    private void scheduleNext(long delay) {
        if (spots.size() >= capacity) return;
        plugin.getServer().getScheduler().runTaskLater(plugin, this::refill, delay);
    }

    /** Release the ticket on the next tick, since the player has not arrived at the moment of taking. Skip the release if the pool still holds a spot in the same chunk. */
    private void releaseNextTick(PooledSpot spot) {
        long g = generation;
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            if (closed || g != generation || holdsChunk(spot.chunkX(), spot.chunkZ())) return;
            World world = plugin.getServer().getWorld(worldId);
            if (world != null) {
                world.removePluginChunkTicket(spot.chunkX(), spot.chunkZ(), plugin);
            }
        });
    }

    private boolean holdsChunk(int chunkX, int chunkZ) {
        return spots.stream().anyMatch(s -> s.chunkX() == chunkX && s.chunkZ() == chunkZ);
    }

    private void onMain(Runnable body) {
        if (!plugin.isEnabled()) return;
        if (plugin.getServer().isPrimaryThread()) {
            body.run();
        } else {
            plugin.getServer().getScheduler().runTask(plugin, body);
        }
    }

    private void requireMainThread() {
        if (!plugin.getServer().isPrimaryThread()) {
            throw new IllegalStateException("SafeSpotPool must be used on the main thread");
        }
    }
}
```

### `SafeTeleportService.java`

```java
package com.example.teleport;

import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent.TeleportCause;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;

/**
 * Warmup -> search (pool first) -> re-validate -> teleportAsync -> finish. Call on the main thread only.
 *
 * <p>Re-validates after every async stage: the player is still online, the gate (combat) still allows it, and the player's world matches the one at request time.
 * The cooldown is recorded only after a successful teleport.
 */
public final class SafeTeleportService {

    public static final String BYPASS_PERMISSION = "teleport.bypass.cooldown";

    private static final MiniMessage MM = MiniMessage.miniMessage();
    private static final long TICKS_PER_SECOND = 20L;

    private record Warmup(Location origin, BukkitTask task) {}

    private final Plugin plugin;
    private final TeleportSettings settings;
    private final TeleportGuard guard;
    private final TeleportCooldowns cooldowns;
    private final SafeSpotFinder finder;
    private final SafeSpotPool pool;
    private final Map<UUID, Warmup> warmups = new HashMap<>();

    public SafeTeleportService(Plugin plugin, TeleportSettings settings, TeleportGuard guard,
                               TeleportCooldowns cooldowns, SafeSpotFinder finder, SafeSpotPool pool) {
        this.plugin = plugin;
        this.settings = settings;
        this.guard = guard;
        this.cooldowns = cooldowns;
        this.finder = finder;
        this.pool = pool;
    }

    /** Randomly teleports to the target world. */
    public void requestRandom(Player player, World target) {
        UUID id = player.getUniqueId();
        Optional<String> denied = guard.denyReason(player);
        if (denied.isPresent()) {
            player.sendMessage(MM.deserialize(denied.get()));
            return;
        }
        if (warmups.containsKey(id)) {
            player.sendMessage(MM.deserialize("<red>You are already waiting to teleport."));
            return;
        }
        Duration left = cooldowns.remaining(id, settings.cooldown());
        if (!left.isZero() && !player.hasPermission(BYPASS_PERMISSION)) {
            player.sendMessage(MM.deserialize("<red>Please wait <seconds>s before teleporting again.",
                Placeholder.unparsed("seconds", Long.toString(left.toSeconds() + 1))));
            return;
        }
        UUID originWorld = player.getWorld().getUID();
        if (settings.warmupTicks() == 0) {
            search(id, target.getUID(), originWorld);
            return;
        }
        player.sendMessage(MM.deserialize("<yellow>Teleporting in <seconds>s. Do not move!",
            Placeholder.unparsed("seconds", Long.toString(settings.warmupTicks() / TICKS_PER_SECOND))));
        BukkitTask task = plugin.getServer().getScheduler().runTaskLater(plugin, () -> {
            warmups.remove(id);
            search(id, target.getUID(), originWorld);
        }, settings.warmupTicks());
        warmups.put(id, new Warmup(player.getLocation().clone(), task));
    }

    /** Called by {@link WarmupListener}: cancels the warmup if the player moves beyond the allowed range from the origin. */
    public void cancelIfMoved(Player player, Location to) {
        Warmup warmup = warmups.get(player.getUniqueId());
        if (warmup == null) return;
        Location origin = warmup.origin();
        boolean sameWorld = origin.getWorld() != null && origin.getWorld().equals(to.getWorld());
        double tolerance = settings.moveToleranceBlocks();
        if (sameWorld && origin.distanceSquared(to) <= tolerance * tolerance) return;
        cancelWarmup(player.getUniqueId());
        player.sendMessage(MM.deserialize("<red>Teleport cancelled because you moved."));
    }

    public void cancelWarmup(UUID playerId) {
        Warmup warmup = warmups.remove(playerId);
        if (warmup != null) warmup.task().cancel();
    }

    public void shutdown() {
        warmups.values().forEach(w -> w.task().cancel());
        warmups.clear();
    }

    private void search(UUID id, UUID targetWorldId, UUID originWorldId) {
        Player player = plugin.getServer().getPlayer(id);
        World world = plugin.getServer().getWorld(targetWorldId);
        if (player == null || world == null || !stillAllowed(player, originWorldId)) return;

        player.sendMessage(MM.deserialize("<gray>Searching for a safe location..."));
        Optional<Location> pooled = pool.take(world);
        if (pooled.isPresent()) {
            arrive(id, originWorldId, pooled.get());
            return;
        }
        finder.find(world, settings.minRadius(), settings.maxRadius(), settings.maxAttempts())
            .whenComplete((found, err) -> onMain(() -> {
                if (err != null) {
                    plugin.getLogger().log(Level.WARNING, "Safe spot search failed", err);
                }
                if (err != null || found.isEmpty()) {
                    Player p = plugin.getServer().getPlayer(id);
                    if (p != null) {
                        p.sendMessage(MM.deserialize("<red>Could not find a safe location. Please try again."));
                    }
                    return;
                }
                arrive(id, originWorldId, found.get());
            }));
    }

    private void arrive(UUID id, UUID originWorldId, Location spot) {
        Player player = plugin.getServer().getPlayer(id);
        World world = spot.getWorld();
        if (player == null || world == null || !stillAllowed(player, originWorldId)) return;

        // A few ticks may have passed since the search; check again before teleporting
        Optional<Location> verified = SafeLocationRules.evaluate(world, spot.getBlockX(), spot.getBlockZ());
        if (verified.isEmpty()) {
            player.sendMessage(MM.deserialize("<red>That location is no longer safe. Please try again."));
            return;
        }
        player.teleportAsync(verified.get(), TeleportCause.PLUGIN)
            .whenComplete((ok, err) -> onMain(() -> finish(id, ok, err)));
    }

    private void finish(UUID id, Boolean ok, Throwable err) {
        if (err != null) {
            plugin.getLogger().log(Level.WARNING, "teleportAsync failed", err);
        }
        Player player = plugin.getServer().getPlayer(id);
        if (player == null) return;
        if (err == null && Boolean.TRUE.equals(ok)) {
            cooldowns.mark(id);
            player.sendMessage(MM.deserialize("<green>Teleported!"));
        } else {
            player.sendMessage(MM.deserialize("<red>Teleport failed. Please try again."));
        }
    }

    /** Called after every async stage: online, gate allows, world unchanged. */
    private boolean stillAllowed(Player player, UUID originWorldId) {
        if (!player.isOnline()) return false;
        Optional<String> denied = guard.denyReason(player);
        if (denied.isPresent()) {
            player.sendMessage(MM.deserialize(denied.get()));
            return false;
        }
        if (!player.getWorld().getUID().equals(originWorldId)) {
            player.sendMessage(MM.deserialize("<red>Teleport cancelled because you changed worlds."));
            return false;
        }
        return true;
    }

    private void onMain(Runnable body) {
        if (!plugin.isEnabled()) return;
        if (plugin.getServer().isPrimaryThread()) {
            body.run();
        } else {
            plugin.getServer().getScheduler().runTask(plugin, body);
        }
    }
}
```

### `WarmupListener.java`

```java
package com.example.teleport;

import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;

public final class WarmupListener implements Listener {

    private final SafeTeleportService service;

    public WarmupListener(SafeTeleportService service) {
        this.service = service;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        if (!event.hasChangedBlock()) return; // Turning the head is not movement, and this also saves per-tick computation
        service.cancelIfMoved(event.getPlayer(), event.getTo());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        service.cancelWarmup(event.getPlayer().getUniqueId());
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/teleport/
├── SafeLocationRules.java      <- stateless checks (shared by RTP/home/pair)
├── SafeSpotFinder.java         <- async spot search
├── SafeSpotPool.java           <- pre-found spot pool (optional)
├── TeleportGuard.java          <- gates such as combat status
├── TeleportCooldowns.java
├── TeleportSettings.java
├── SafeTeleportService.java
├── WarmupListener.java
└── TeleportPlugin.java         <- wiring (see examples.md)
```

## Thread Safety

- Treat both the `getChunkAtAsync` future and the `teleportAsync` completion callback as "back on the main thread"; the templates still use `onMain` as a safeguard and give up when `plugin.isEnabled()` is false (`runTask` throws `IllegalPluginAccessException` while the plugin is disabling)
- Carry only a `UUID` between async stages; call `getPlayer` / `getWorld` again afterwards and never hold a `Player` reference
- Block reads (`SafeLocationRules`), `WorldBorder`, and `addPluginChunkTicket` always run on the main thread
- The pool and warmup map are accessed only on the main thread and need no locks; the cooldown map uses `ConcurrentHashMap` because persistence may read the snapshot on another thread
- See [`references/paper-threading.md`](references/paper-threading.md)
- Block teleporting during combat: integrate [`paper-combat-tag`](../paper-combat-tag/SKILL.md) through `TeleportGuard.blockWhileTagged`

## Fallback

| Problem | Cause | Solution |
|------|------|------|
| Never finds a spot | The range is mostly ocean/lava, or `max_attempts` is too small | Adjust the radius or raise the attempt count; the player already gets a message and it never retries forever |
| Teleported into an underground cave / tree top | `MOTION_BLOCKING_NO_LEAVES` was not used | Use the template's heightmap in overworld-like worlds; do not scan down from y=319 yourself |
| Nether teleport lands on the roof or inside bedrock | Used the highest block directly | In `hasCeiling()` worlds scan down from `logicalHeight - 8` |
| Teleported outside the border | Forgot to check `WorldBorder#isInside` | The rules already include it; keep it in any custom rules |
| Standing in fire or sweet berry bushes | Only checked "passable" | Also check each block above against the hazard list |
| Two players land on the same spot in one tick | The pool is not single-use | `take` removes first and then re-validates; no duplicate chunks in the pool |
| Player teleports despite entering combat during warmup | The gate is checked only at command start | Call `guard.denyReason` after every stage |
| NPE after the player logs out | Holding a `Player` reference | Pass only the UUID, re-fetch afterwards, and check `isOnline()` |
| Cooldown disappears after a restart | Cooldowns live only in memory | Persist `snapshot()` and pass `restored` at startup |
| Pool chunks get unloaded | No chunk ticket held | `addPluginChunkTicket`; call `removePluginChunkTickets` in `close()` |
