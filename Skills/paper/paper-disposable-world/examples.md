# examples — paper-disposable-world

## 範例 1：決鬥開始時從池領一張世界，結束時銷毀

**Input:**
```
base_package: com.example.arena
template_folder: plugins/Arena/templates/duel_map
pool_size: 2
reset_mode: swap
```

**Output — 開局領世界、傳送玩家；結束時先傳走再銷毀（`ArenaPool` 與 `DisposableWorlds` 見 SKILL.md）:**
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

    /** 主執行緒。池空時回 false，呼叫端讓玩家繼續排隊，不要同步等複製。 */
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

    /** 主執行緒。destroy 會先把世界裡的玩家傳到主世界，確認沒人才卸載。 */
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

## 範例 2：就地還原 —— 比賽結束時分批還原並清殘留

**Input:**
```
reset_mode: in-place
blocks_per_tick: 2000
nanos_per_tick: 2000000
```

**Output — 開賽前 `track`，結束時先移走玩家、再 `reset`；溢位時退回換世界:**
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

    /** 開賽前呼叫一次；之後這張世界的方塊變更都會被記下。 */
    public void open() {
        recorder.track(arena);
    }

    /** 比賽結束：玩家先離開 → 預算式還原 → 完成後通知。 */
    public void close(List<Player> players) {
        for (Player player : players) {
            player.teleportAsync(lobby);
        }
        resets.reset(arena).whenComplete((restored, error) -> {
            if (error != null) {
                // 溢位或世界已卸載：這張圖不再可信，交給換世界路線
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

## 範例 3：定時清理殘留實體（比賽進行中）

**Input:**
```
ttl_seconds: 30
safe_radius: 16
```

**Output — 每 5 秒掃一次；已點燃的 TNT 礦車與界伏盒物品豁免:**
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

    /** worlds 由呼叫端提供目前進行中的競技場世界；主執行緒呼叫。 */
    public BukkitTask start(Plugin plugin, Supplier<List<World>> worlds) {
        return plugin.getServer().getScheduler().runTaskTimer(plugin, () -> {
            for (World world : worlds.get()) {
                sweeper.sweepStale(world, TTL_MILLIS, SAFE_RADIUS);
            }
        }, INTERVAL_TICKS, INTERVAL_TICKS);
    }
}
```
