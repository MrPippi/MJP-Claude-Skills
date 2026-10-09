# examples — paper-safe-teleport

## 範例 1：`/rtp` 指令組裝（暖機 5 秒、冷卻 5 分鐘、落點池 4 個、戰鬥中禁止）

**Input:**
```
base_package: com.example.teleport
world: world
min_radius: 500
max_radius: 5000
max_attempts: 12
warmup_ticks: 100
cooldown: PT5M
pool_size: 4
```

**Output — 插件主類別（組裝、啟動池、停用時收尾）:**
```java
import org.bukkit.World;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.random.RandomGenerator;

public final class TeleportPlugin extends JavaPlugin {

    private SafeTeleportService service;
    private SafeSpotPool pool;

    @Override
    public void onEnable() {
        World world = getServer().getWorld("world");
        if (world == null) {
            getLogger().severe("World 'world' not found; disabling.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        TeleportSettings settings = new TeleportSettings(100, Duration.ofMinutes(5), 500, 5000, 12, 0.5);
        SafeSpotFinder finder = new SafeSpotFinder(RandomGenerator.getDefault());
        pool = new SafeSpotPool(this, finder, world.getUID(), settings, 4);

        // paper-combat-tag 提供的服務在這裡接入；沒有安裝時用 allowAll()
        TeleportGuard guard = TeleportGuard.allowAll();

        TeleportCooldowns cooldowns = new TeleportCooldowns(Clock.systemUTC(), Map.of());
        service = new SafeTeleportService(this, settings, guard, cooldowns, finder, pool);
        getServer().getPluginManager().registerEvents(new WarmupListener(service), this);
        pool.start();
    }

    @Override
    public void onDisable() {
        if (service != null) service.shutdown();
        if (pool != null) pool.close();
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Players only.");
            return true;
        }
        World world = getServer().getWorld("world");
        if (world == null) {
            player.sendMessage("The RTP world is unavailable.");
            return true;
        }
        service.requestRandom(player, world);
        return true;
    }
}
```

**plugin.yml:**
```yaml
name: SafeTeleport
main: com.example.teleport.TeleportPlugin
version: '1.0.0'
api-version: '26.2'
commands:
  rtp:
    description: Teleport to a random safe location
    permission: teleport.rtp
permissions:
  teleport.rtp:
    default: true
  teleport.bypass.cooldown:
    default: op
```

要點：
- 指令只負責「發出請求」，暖機、找點、重驗全在 `SafeTeleportService`
- 池只服務目標世界；其他世界的請求自然 fallback 到即時搜尋
- 換成 [`paper-combat-tag`](../paper-combat-tag/SKILL.md) 後：`TeleportGuard.blockWhileTagged(combatTagService::isTagged)`

---

## 範例 2：傳到「家」前先確認落點安全，不安全就找附近

**Input:**
```
base_package: com.example.teleport
scenario: 玩家的家被改建（地板被挖、被岩漿淹沒），傳送前要檢查
```

**Output — 家的落點解析（主執行緒；先確保區塊已載入）:**
```java
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent.TeleportCause;
import org.bukkit.plugin.Plugin;

import java.util.Optional;
import java.util.UUID;

public final class HomeTeleporter {

    private static final MiniMessage MM = MiniMessage.miniMessage();
    private static final int SEARCH_RADIUS = 4;
    private static final int CHUNK_SHIFT = 4;

    private final Plugin plugin;
    private final TeleportGuard guard;

    public HomeTeleporter(Plugin plugin, TeleportGuard guard) {
        this.plugin = plugin;
        this.guard = guard;
    }

    /** home 為玩家儲存的位置。在主執行緒呼叫。 */
    public void teleportHome(Player player, Location home) {
        World world = home.getWorld();
        if (world == null) {
            player.sendMessage(MM.deserialize("<red>Your home world is not loaded."));
            return;
        }
        UUID id = player.getUniqueId();
        UUID originWorld = player.getWorld().getUID();

        world.getChunkAtAsync(home.getBlockX() >> CHUNK_SHIFT, home.getBlockZ() >> CHUNK_SHIFT)
            .whenComplete((chunk, err) -> plugin.getServer().getScheduler().runTask(plugin, () -> {
                Player p = plugin.getServer().getPlayer(id);
                if (p == null || !p.isOnline()) return;
                Optional<String> denied = guard.denyReason(p);
                if (denied.isPresent()) {
                    p.sendMessage(MM.deserialize(denied.get()));
                    return;
                }
                if (err != null || chunk == null || !p.getWorld().getUID().equals(originWorld)) {
                    p.sendMessage(MM.deserialize("<red>Teleport cancelled."));
                    return;
                }
                // 原位置仍安全 → 用原位置；否則找最近的安全點；都沒有就拒絕，不硬傳
                Optional<Location> target = SafeLocationRules.evaluate(world, home.getBlockX(), home.getBlockZ())
                    .or(() -> SafeLocationRules.findNearby(world, home, SEARCH_RADIUS));
                if (target.isEmpty()) {
                    p.sendMessage(MM.deserialize("<red>Your home is blocked or unsafe. No safe spot nearby."));
                    return;
                }
                Location dest = target.get();
                dest.setYaw(home.getYaw());
                dest.setPitch(home.getPitch());
                p.teleportAsync(dest, TeleportCause.PLUGIN).whenComplete((ok, tpErr) ->
                    plugin.getServer().getScheduler().runTask(plugin, () -> {
                        Player after = plugin.getServer().getPlayer(id);
                        if (after != null) {
                            after.sendMessage(MM.deserialize(
                                tpErr == null && Boolean.TRUE.equals(ok) ? "<green>Welcome home!" : "<red>Teleport failed."));
                        }
                    }));
            }));
    }
}
```

要點：
- 家是玩家自己選的位置，**優先保留原位**；只有原位不安全才退而求其次找附近
- `findNearby` 只看已載入區塊，所以先 `getChunkAtAsync`
- 同樣的規則類別，RTP 與家不重複實作

---

## 範例 3：配對／佇列 RTP（兩人一組，落在彼此附近）

**Input:**
```
base_package: com.example.teleport
scenario: 玩家輸入 /rtp pair，兩個人湊成一組後一起傳到同一個隨機區域
```

**Output — 佇列只存 UUID；湊滿兩人才搜尋一次，兩人落點相鄰:**
```java
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent.TeleportCause;
import org.bukkit.plugin.Plugin;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Optional;
import java.util.UUID;

public final class PairRtpQueue {

    private static final MiniMessage MM = MiniMessage.miniMessage();
    private static final int PARTNER_RADIUS = 3;

    private final Plugin plugin;
    private final TeleportSettings settings;
    private final TeleportGuard guard;
    private final SafeSpotFinder finder;
    private final Deque<UUID> waiting = new ArrayDeque<>();

    public PairRtpQueue(Plugin plugin, TeleportSettings settings, TeleportGuard guard, SafeSpotFinder finder) {
        this.plugin = plugin;
        this.settings = settings;
        this.guard = guard;
        this.finder = finder;
    }

    /** 主執行緒。第一個人排隊，第二個人進來時兩人一起出發。 */
    public void join(Player player, World world) {
        UUID id = player.getUniqueId();
        Optional<String> denied = guard.denyReason(player);
        if (denied.isPresent()) {
            player.sendMessage(MM.deserialize(denied.get()));
            return;
        }
        if (waiting.contains(id)) {
            player.sendMessage(MM.deserialize("<yellow>You are already in the queue."));
            return;
        }
        UUID partnerId = pollOnlinePartner();
        if (partnerId == null) {
            waiting.addLast(id);
            player.sendMessage(MM.deserialize("<yellow>Waiting for a partner..."));
            return;
        }
        dispatch(partnerId, id, world);
    }

    public void leave(UUID playerId) {
        waiting.remove(playerId);
    }

    /** 取出第一個仍在線的等待者；已離線的直接丟掉。 */
    private UUID pollOnlinePartner() {
        while (!waiting.isEmpty()) {
            UUID candidate = waiting.pollFirst();
            Player p = plugin.getServer().getPlayer(candidate);
            if (p != null && p.isOnline()) return candidate;
        }
        return null;
    }

    private void dispatch(UUID first, UUID second, World world) {
        finder.find(world, settings.minRadius(), settings.maxRadius(), settings.maxAttempts())
            .whenComplete((found, err) -> plugin.getServer().getScheduler().runTask(plugin, () -> {
                Player a = plugin.getServer().getPlayer(first);
                Player b = plugin.getServer().getPlayer(second);
                if (err != null || found.isEmpty() || a == null || b == null) {
                    tell(a, "<red>Pair teleport failed. Please queue again.");
                    tell(b, "<red>Pair teleport failed. Please queue again.");
                    return;
                }
                // 搜尋期間任一人進入戰鬥 → 兩人都取消，避免只剩一人落單
                if (guard.denyReason(a).isPresent() || guard.denyReason(b).isPresent()) {
                    tell(a, "<red>Pair teleport cancelled.");
                    tell(b, "<red>Pair teleport cancelled.");
                    return;
                }
                Location anchor = found.get();
                // 第二個落點取 anchor 附近的另一個安全點；找不到就和第一個人同點
                Location partnerSpot = SafeLocationRules.findNearby(world, anchor, PARTNER_RADIUS)
                    .filter(loc -> loc.getBlockX() != anchor.getBlockX() || loc.getBlockZ() != anchor.getBlockZ())
                    .orElse(anchor);
                a.teleportAsync(anchor, TeleportCause.PLUGIN);
                b.teleportAsync(partnerSpot, TeleportCause.PLUGIN);
                tell(a, "<green>Teleported with your partner!");
                tell(b, "<green>Teleported with your partner!");
            }));
    }

    private static void tell(Player player, String message) {
        if (player != null) player.sendMessage(MM.deserialize(message));
    }
}
```

要點：
- 佇列只存 `UUID`；配對時才 `getPlayer`，離線者直接略過
- 只搜尋**一次**，第二個人用 `findNearby` 取相鄰安全點，不必兩次載入遠方區塊
- 出發前兩人都要通過閘門，否則整組取消（不讓一個人落單）
- 範例略過冷卻與暖機；正式使用時沿用 `SafeTeleportService` 的相同階段（暖機 → 重驗 → 傳送 → 記冷卻）
