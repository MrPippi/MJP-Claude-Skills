# Paper API 執行緒規則 / Paper API Threading Rules

`Skills/paper/` 技能共用的執行緒規則。NMS 與 Netty 層的規則見 [`nms-threading.md`](nms-threading.md)。

---

## 1. 哪段程式碼跑在哪個執行緒

| 情境 | 執行緒 | 可以呼叫 Bukkit API？ |
|------|--------|---------------------|
| 事件 listener、指令、`runTask` / `runTaskTimer` | **主執行緒** | ✅ |
| `runTaskAsynchronously`、自建 `ExecutorService` | 非同步 | ❌ |
| JDBC、HTTP、檔案 IO | 必須在非同步 | ❌ |
| Dialog 的 `DialogAction.customClick` 回呼 | **不保證在主執行緒** | ❌（先切回主執行緒） |
| PlaceholderAPI `onRequest` / `onPlaceholderRequest` | 任何執行緒 | ❌（只讀快照） |
| PacketEvents / ProtocolLib listener | Netty IO 執行緒 | ❌（只讀快照） |
| `teleportAsync` / `getChunkAtAsync` 的完成回呼 | 主執行緒（Paper 保證） | ✅，但要重新驗證狀態 |
| `onDisable` | 主執行緒；scheduler 已不接受新任務 | ✅，且要**同步**寫回資料 |

---

## 2. 標準流程：快照 → 非同步 → 回主執行緒重新驗證

```java
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.UUID;
import java.util.function.Function;

public final class AsyncFlow {

    private AsyncFlow() {}

    /**
     * 在非同步執行 work（例如查資料庫），完成後回到主執行緒交給 onMain。
     * lambda 只攜帶 UUID / 字串 / 數字，不攜帶 Player 等 Bukkit 物件。
     */
    public static <T> void load(Plugin plugin, UUID playerId, Function<UUID, T> work,
                                java.util.function.BiConsumer<Player, T> onMain) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            T result = work.apply(playerId);
            Bukkit.getScheduler().runTask(plugin, () -> {
                Player player = Bukkit.getPlayer(playerId);   // 重新取得：玩家可能已離線
                if (player == null || !player.isOnline()) return;
                onMain.accept(player, result);
            });
        });
    }
}
```

重點：
- 非同步階段**不要**碰 `Player`、`World`、`ItemStack` 等 Bukkit 物件
- 回到主執行緒後**重新驗證**：玩家是否還在線、GUI 是否仍開著、餘額是否仍足夠
- 插件停用中呼叫 `runTask` 會丟 `IllegalPluginAccessException`；可能在停用期間觸發的回呼先檢查 `plugin.isEnabled()`

---

## 3. 非主執行緒回呼（Dialog、PAPI、封包）

```java
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;

public final class MainThread {

    private MainThread() {}

    /** 從任意執行緒安全地切回主執行緒；插件停用中則直接放棄。 */
    public static void run(Plugin plugin, Runnable task) {
        if (!plugin.isEnabled()) return;
        if (Bukkit.isPrimaryThread()) {
            task.run();
            return;
        }
        try {
            Bukkit.getScheduler().runTask(plugin, task);
        } catch (IllegalStateException e) {
            // 停用途中 scheduler 拒收（IllegalPluginAccessException 繼承自 IllegalStateException）
        }
    }
}
```

PAPI 與封包 listener 不切執行緒，而是讀**不可變快照**：主執行緒定期建立新快照，再以 `volatile` 欄位整份替換。

```java
import java.util.Map;
import java.util.UUID;

public final class BalanceSnapshot {

    private volatile Map<UUID, Long> balances = Map.of();

    /** 主執行緒或寫入執行緒呼叫：整份替換，不修改舊 Map。 */
    public void publish(Map<UUID, Long> fresh) {
        this.balances = Map.copyOf(fresh);
    }

    /** 任何執行緒呼叫（PAPI、封包）。 */
    public long get(UUID playerId) {
        return balances.getOrDefault(playerId, 0L);
    }
}
```

---

## 4. 非同步傳送與區塊載入

```java
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent;

public final class Teleports {

    private Teleports() {}

    /** Paper 的 teleportAsync 會先非同步載入區塊；完成回呼在主執行緒。 */
    public static void to(Player player, Location target) {
        player.teleportAsync(target, PlayerTeleportEvent.TeleportCause.PLUGIN).thenAccept(success -> {
            if (!success || !player.isOnline()) return;
            // 這裡在主執行緒：可安全發訊息、播放音效
        });
    }
}
```

需要先檢查落點時用 `world.getChunkAtAsync(x, z)`，完成後在主執行緒讀取方塊，見 `paper-safe-teleport`。

---

## 5. 定時任務與停用

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
                // 每 tick 執行的任務：例外只記錄一次，避免洗版；任務本身不中斷
                if (!errorLogged) {
                    errorLogged = true;
                    plugin.getLogger().log(Level.SEVERE, "Ticker failed (further errors suppressed)", e);
                }
            }
        }, 20L, 20L);
    }

    /** onDisable 呼叫：對半初始化狀態也安全。 */
    public void stop() {
        if (task != null) task.cancel();
    }
}
```

`onDisable` 的順序：
1. 取消所有定時任務
2. 關閉本插件開啟的 GUI／Dialog
3. **同步**把待寫入的資料寫回（scheduler 已關閉，不能再排非同步任務）
4. 關閉 HTTP server、executor、資料庫連線

---

## 6. 不做的事

- 不在非同步執行緒呼叫 `player.sendMessage()` 以外的 Bukkit API（`sendMessage` 雖然執行緒安全，仍建議統一在主執行緒）
- 不在主執行緒做 JDBC／HTTP
- 不用 `synchronized` 包 Bukkit 物件；改用快照或 `ConcurrentHashMap<UUID, …>`
- 本庫範本不支援 Folia（BlockoSMP、Bydsmp 皆未使用）；需要 Folia 時改用 region scheduler
