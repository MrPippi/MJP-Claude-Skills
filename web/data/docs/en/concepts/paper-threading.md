# Paper API Threading Rules

Threading rules shared by the `Skills/paper/` skills. For NMS and Netty-level rules, see [`nms-threading.md`](nms-threading.md).

---

## 1. Which Code Runs on Which Thread

| Situation | Thread | Can call Bukkit API? |
|------|--------|---------------------|
| Event listeners, commands, `runTask` / `runTaskTimer` | **Main thread** | ✅ |
| `runTaskAsynchronously`, a self-created `ExecutorService` | Async | ❌ |
| JDBC, HTTP, file IO | Must be async | ❌ |
| Dialog `DialogAction.customClick` callback | **Not guaranteed to be on the main thread** | ❌ (switch back to the main thread first) |
| PlaceholderAPI `onRequest` / `onPlaceholderRequest` | Any thread | ❌ (read snapshots only) |
| PacketEvents / ProtocolLib listeners | Netty IO thread | ❌ (read snapshots only) |
| Completion callbacks of `teleportAsync` / `getChunkAtAsync` | Main thread (guaranteed by Paper) | ✅, but re-validate state |
| `onDisable` | Main thread; the scheduler no longer accepts new tasks | ✅, and data must be written back **synchronously** |

---

## 2. Standard Flow: Snapshot → Async → Back to Main Thread and Re-validate

```java
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.UUID;
import java.util.function.Function;

public final class AsyncFlow {

    private AsyncFlow() {}

    /**
     * Runs work async (e.g. a database query), then returns to the main thread and hands the result to onMain.
     * The lambda carries only UUIDs / strings / numbers, never Bukkit objects such as Player.
     */
    public static <T> void load(Plugin plugin, UUID playerId, Function<UUID, T> work,
                                java.util.function.BiConsumer<Player, T> onMain) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            T result = work.apply(playerId);
            Bukkit.getScheduler().runTask(plugin, () -> {
                Player player = Bukkit.getPlayer(playerId);   // Fetch again: the player may have gone offline
                if (player == null || !player.isOnline()) return;
                onMain.accept(player, result);
            });
        });
    }
}
```

Key points:
- In the async phase, **do not** touch Bukkit objects such as `Player`, `World`, `ItemStack`
- After returning to the main thread, **re-validate**: is the player still online, is the GUI still open, is the balance still sufficient
- Calling `runTask` while the plugin is being disabled throws `IllegalPluginAccessException`; callbacks that may fire during disable should check `plugin.isEnabled()` first

---

## 3. Non-Main-Thread Callbacks (Dialog, PAPI, Packets)

```java
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;

public final class MainThread {

    private MainThread() {}

    /** Safely switch back to the main thread from any thread; give up if the plugin is being disabled. */
    public static void run(Plugin plugin, Runnable task) {
        if (!plugin.isEnabled()) return;
        if (Bukkit.isPrimaryThread()) {
            task.run();
            return;
        }
        try {
            Bukkit.getScheduler().runTask(plugin, task);
        } catch (IllegalStateException e) {
            // The scheduler rejected the task mid-disable (IllegalPluginAccessException extends IllegalStateException)
        }
    }
}
```

PAPI and packet listeners do not switch threads; they read an **immutable snapshot** instead: the main thread periodically builds a new snapshot, then swaps the whole thing via a `volatile` field.

```java
import java.util.Map;
import java.util.UUID;

public final class BalanceSnapshot {

    private volatile Map<UUID, Long> balances = Map.of();

    /** Called from the main thread or the writer thread: replace the whole map, never modify the old one. */
    public void publish(Map<UUID, Long> fresh) {
        this.balances = Map.copyOf(fresh);
    }

    /** Called from any thread (PAPI, packets). */
    public long get(UUID playerId) {
        return balances.getOrDefault(playerId, 0L);
    }
}
```

---

## 4. Async Teleport and Chunk Loading

```java
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent;

public final class Teleports {

    private Teleports() {}

    /** Paper's teleportAsync loads the chunk async first; the completion callback runs on the main thread. */
    public static void to(Player player, Location target) {
        player.teleportAsync(target, PlayerTeleportEvent.TeleportCause.PLUGIN).thenAccept(success -> {
            if (!success || !player.isOnline()) return;
            // On the main thread here: safe to send messages and play sounds
        });
    }
}
```

When the landing spot must be checked first, use `world.getChunkAtAsync(x, z)` and read blocks on the main thread after completion; see `paper-safe-teleport`.

---

## 5. Scheduled Tasks and Disabling

```java
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.logging.Level;

public final class SafeTicker {

    private final Plugin plugin;
    private BukkitTask task;
    private boolean errorLogged;

    public SafeTicker(Plugin plugin) {
        this.plugin = plugin;
    }

    public void start(Runnable tick) {
        task = plugin.getServer().getScheduler().runTaskTimer(plugin, () -> {
            try {
                tick.run();
            } catch (RuntimeException e) {
                // Task that runs every tick: log the exception only once to avoid log spam; the task itself keeps running
                if (!errorLogged) {
                    errorLogged = true;
                    plugin.getLogger().log(Level.SEVERE, "Ticker failed (further errors suppressed)", e);
                }
            }
        }, 20L, 20L);
    }

    /** Called from onDisable: safe even in a partially initialized state. */
    public void stop() {
        if (task != null) task.cancel();
    }
}
```

`onDisable` order:
1. Cancel all scheduled tasks
2. Close the GUIs / Dialogs this plugin opened
3. Write pending data back **synchronously** (the scheduler is already shut down, so no more async tasks can be queued)
4. Close the HTTP server, executors, and database connections

---

## 6. What Not to Do

- Do not call Bukkit APIs other than `player.sendMessage()` from an async thread (`sendMessage` is thread-safe, but it is still recommended to do it on the main thread consistently)
- Do not do JDBC / HTTP on the main thread
- Do not wrap Bukkit objects in `synchronized`; use snapshots or `ConcurrentHashMap<UUID, …>` instead
- This repository's templates do not support Folia (neither BlockoSMP nor Bydsmp uses it); switch to the region scheduler if Folia is needed
