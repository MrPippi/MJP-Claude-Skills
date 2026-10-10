# examples — paper-disposable-world

## Example 1: Take a world from the pool at duel start, destroy it at the end

**Input:**
```
base_package: com.example.arena
template_folder: plugins/Arena/templates/duel_map
pool_size: 2
reset_mode: swap
```

**Output — acquire a world and teleport players at start; move players out, then destroy at the end (`ArenaPool` and `DisposableWorlds` are in SKILL.md):**
```java
package com.example.arena;

import net.kyori.adventure.text.Component;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.List;
import java.util.Optional;
import java.util.logging.Level;

public final class DuelMatches {

    private final Plugin plugin;
    private final ArenaPool pool;

    public DuelMatches(Plugin plugin, ArenaPool pool) {
        this.plugin = plugin;
        this.pool = pool;
    }

    /** Main thread. Returns false when the pool is empty; the caller keeps players queued instead of waiting synchronously for a copy. */
    public boolean start(List<Player> players) {
        Optional<World> arena = pool.acquire();
        if (arena.isEmpty()) {
            players.forEach(p -> p.sendMessage(Component.text("All arenas are busy, please wait.")));
            return false;
        }
        Location spawn = new Location(arena.get(), 0.5, 64.0, 0.5);
        for (Player player : players) {
            player.teleportAsync(spawn);
        }
        return true;
    }

    /** Main thread. destroy first teleports players in the world to the main world, and unloads only after confirming it is empty. */
    public void end(World arena) {
        pool.release(arena).whenComplete((v, error) -> {
            if (error != null) {
                plugin.getLogger().log(Level.WARNING, "Could not destroy " + arena.getName(), error);
            }
        });
    }
}
```

---

## Example 2: In-place reset - restore in batches and sweep debris when the match ends

**Input:**
```
reset_mode: in-place
blocks_per_tick: 2000
nanos_per_tick: 2000000
```

**Output — `track` before the match; at the end move players out first, then `reset`; fall back to world swapping on overflow:**
```java
package com.example.arena;

import net.kyori.adventure.text.Component;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.List;
import java.util.logging.Level;

public final class InPlaceArena {

    private final Plugin plugin;
    private final ChangeRecorder recorder;
    private final ArenaResetService resets;
    private final World arena;
    private final Location lobby;

    public InPlaceArena(Plugin plugin, ChangeRecorder recorder, ArenaResetService resets, World arena, Location lobby) {
        this.plugin = plugin;
        this.recorder = recorder;
        this.resets = resets;
        this.arena = arena;
        this.lobby = lobby;
    }

    /** Call once before the match starts; afterwards every block change in this world is recorded. */
    public void open() {
        recorder.track(arena);
    }

    /** Match end: players leave first -> budgeted restore -> notify when done. */
    public void close(List<Player> players) {
        for (Player player : players) {
            player.teleportAsync(lobby);
        }
        resets.reset(arena).whenComplete((restored, error) -> {
            if (error != null) {
                // Overflow or world already unloaded: this map is no longer trustworthy, hand it to the world-swap route
                plugin.getLogger().log(Level.WARNING, "In-place reset failed for " + arena.getName(), error);
                return;
            }
            plugin.getLogger().info("Restored " + restored + " blocks in " + arena.getName());
            players.forEach(p -> p.sendMessage(Component.text("Arena is ready for the next round.")));
        });
    }
}
```

---

## Example 3: Periodically sweep debris entities (during a match)

**Input:**
```
ttl_seconds: 30
safe_radius: 16
```

**Output — sweep every 5 seconds; ignited TNT minecarts and shulker box items are exempt:**
```java
package com.example.arena;

import org.bukkit.World;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.List;
import java.util.function.Supplier;

public final class DebrisTimer {

    private static final long INTERVAL_TICKS = 100L;
    private static final long TTL_MILLIS = 30_000L;
    private static final double SAFE_RADIUS = 16.0;

    private final DebrisSweeper sweeper = new DebrisSweeper();

    /** worlds is supplied by the caller as the arena worlds currently in play; call on the main thread. */
    public BukkitTask start(Plugin plugin, Supplier<List<World>> worlds) {
        return plugin.getServer().getScheduler().runTaskTimer(plugin, () -> {
            for (World world : worlds.get()) {
                sweeper.sweepStale(world, TTL_MILLIS, SAFE_RADIUS);
            }
        }, INTERVAL_TICKS, INTERVAL_TICKS);
    }
}
```
