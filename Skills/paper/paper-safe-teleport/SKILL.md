---
name: paper-safe-teleport
description: "安全隨機傳送（RTP）與安全落點傳送：getChunkAtAsync 後在主執行緒判定、teleportAsync 完成後重新驗證、暖機移動取消與冷卻、預找落點池 / Safe random teleport and safe-location teleports on Paper with async chunk loading, re-validation, warmup, cooldowns and a spot pool"
---

# Paper Safe Teleport / 安全傳送

## 技能名稱 / Skill Name

`paper-safe-teleport`

## 目的 / Purpose

實作「不會把玩家傳進岩漿、虛空或牆裡」的傳送：隨機傳送（RTP）、傳送到玩家設定點（家、地標）前的落點檢查，以及暖機（站著不動 N 秒）與冷卻。

核心做法：
- 先用 `World#getChunkAtAsync` 讓 Paper 在背景載入／生成區塊，future 在**主執行緒**完成後才讀方塊並判定安全
- 判定規則集中在一個無狀態類別，RTP、家、配對傳送共用
- 找點次數有上限，找不到就回覆玩家訊息，不無限重試
- `Player#teleportAsync` 完成後回主執行緒收尾；每個非同步階段回來都**重新驗證**（玩家在線、沒進入戰鬥、世界沒變）
- 可選的預找落點池：分步補點，取用時重驗並立即作廢，避免同 tick 兩人傳到同一點

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（範本在兩版皆編譯驗證，無差異）
- 純 Paper API，不需要 Paperweight
- 只用 `World`、`WorldBorder`、`HeightMap`、`Player#teleportAsync`、`BukkitScheduler`

## 觸發條件 / Triggers

- 「隨機傳送」「RTP」「random teleport」「/rtp」「wild」
- 「安全傳送」「safe teleport」「安全落點」「safe location」
- 「傳送暖機」「warmup」「冷卻」「teleport cooldown」
- 「teleportAsync」「getChunkAtAsync」「落點池」「spot pool」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `base_package` | `com.example.teleport` | 產生類別的 package |
| `world` | `world` | RTP 目標世界 |
| `min_radius` / `max_radius` | `500` / `5000` | 以世界出生點為中心的環狀範圍（格） |
| `max_attempts` | `12` | 每次搜尋最多嘗試幾個隨機點 |
| `warmup_ticks` | `100` | 暖機時間（0 = 不暖機） |
| `cooldown` | `PT5M` | 冷卻時間（ISO-8601 Duration） |
| `pool_size` | `4` | 預找落點池容量（0 = 不使用） |

## 輸出產物 / Outputs

- `SafeLocationRules.java` — 無狀態安全判定（落點規則、下界天花板、世界邊界）
- `SafeSpotFinder.java` — 有次數上限的非同步找點
- `SafeSpotPool.java` — 預找落點池（分步補點、一次性取用、chunk ticket）
- `TeleportGuard.java` — 傳送前閘門（戰鬥狀態等），回傳拒絕原因
- `TeleportCooldowns.java` — 以 UUID 為 key、存時間戳的冷卻
- `TeleportSettings.java` — 不可變設定
- `SafeTeleportService.java` — 暖機 → 找點 → 重驗 → `teleportAsync` → 收尾
- `WarmupListener.java` — 移動取消與離線清理

## 建置設定 / Build Setup

見 [`Skills/paper-api/PLATFORM.md`](../../paper-api/PLATFORM.md)。只需要 `paper-api`（`compileOnly`）。戰鬥標記由 [`paper-combat-tag`](../paper-combat-tag/SKILL.md) 提供，本技能只透過 `TeleportGuard` 介面接入，不在編譯期依賴它。

## 安全落點規則 / Safe Location Rules

| 項目 | 規則 |
|------|------|
| 腳下方塊 | 實心、非液體、不在危險清單、不是樹葉 |
| 身體空間 | 腳（y+1）與頭（y+2）都可通行且非液體 |
| 頭頂淨空 | 再往上一格（y+3）也必須可通行，避免跳起撞頭或被卡住 |
| 危險方塊 | 岩漿、水、火、營火、岩漿塊、細雪、仙人掌、甜漿果叢、滴水石錐、凋零玫瑰、蜘蛛網、傳送門 |
| 高度圖 | 地上世界用 `HeightMap.MOTION_BLOCKING_NO_LEAVES`，不會落在樹冠上 |
| 虛空 | 最高方塊落在世界最低高度（無地面）視為失敗 |
| 世界邊界 | 落點必須 `WorldBorder#isInside` |
| 下界 | `World#hasCeiling()` 的世界（下界）最高方塊是岩盤頂（y 約 123–127），改由 `logicalHeight - 8`（120）往下找地板，頭頂不會碰到岩盤層，也不會落在 y ≥ 127 的屋頂上 |

## 代碼範本 / Code Template

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
 * 無狀態的安全落點判定。<b>只能在主執行緒、且該區塊已載入時呼叫</b>
 * （先 {@code getChunkAtAsync}，future 完成後再來這裡）。
 */
public final class SafeLocationRules {

    /** 腳（y+1）、頭（y+2）、頭頂淨空（y+3）。 */
    private static final int HEADROOM = 3;
    /** 下界岩盤頂在 logicalHeight-5 ~ -1；地面最高取 logicalHeight-8，頭頂三格仍在岩盤層之下。 */
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

    /** 在 (x, z) 這一欄找安全落點；回傳腳的位置（方塊中心）。區塊未載入、不安全或在邊界外回 empty。 */
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

    /** 以 center 為中心，由近到遠（方形環）找最近的安全落點；只看已載入的區塊。 */
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
            return OptionalInt.empty(); // 虛空或頂到世界高度
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
            // 可通行不代表安全：FIRE、SWEET_BERRY_BUSH 沒有碰撞箱，要另外比對危險清單
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
 * 有次數上限的非同步找點：隨機 (x, z) → {@code getChunkAtAsync}（future 在主執行緒完成）→ 主執行緒判定。
 * 無狀態；亂數來源由外部注入（測試可給固定種子）。
 */
public final class SafeSpotFinder {

    private static final int CHUNK_SHIFT = 4;

    private final RandomGenerator rng;

    public SafeSpotFinder(RandomGenerator rng) {
        this.rng = rng;
    }

    /** 在出生點周圍 [minRadius, maxRadius] 的環內找；用盡 maxAttempts 次回 empty（future 不會以例外完成）。 */
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
                return SafeLocationRules.evaluate(world, x, z); // 此處已在主執行緒
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
 * 傳送前閘門：回傳拒絕原因（MiniMessage 字串），empty 代表放行。
 * 暖機開始前、搜尋完成後、{@code teleportAsync} 前各檢查一次——戰鬥標記可能在暖機期間才產生。
 */
@FunctionalInterface
public interface TeleportGuard {

    Optional<String> denyReason(Player player);

    /** 戰鬥狀態來源；由 paper-combat-tag 的服務實作（見該技能）。 */
    @FunctionalInterface
    interface CombatStatus {
        boolean isTagged(UUID playerId);
    }

    static TeleportGuard allowAll() {
        return player -> Optional.empty();
    }

    /** 戰鬥中禁止傳送。 */
    static TeleportGuard blockWhileTagged(CombatStatus status) {
        return player -> status.isTagged(player.getUniqueId())
            ? Optional.of("<red>You cannot teleport while in combat.")
            : Optional.empty();
    }

    /** 依序套用，第一個拒絕原因勝出。 */
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
 * 冷卻：以 UUID 為 key，存「上次成功傳送的時間戳（epoch millis）」。
 * 存時間戳而非倒數秒數：重啟後仍可還原，也不需要每 tick 遞減。Clock 注入以利測試。
 */
public final class TeleportCooldowns {

    private final Clock clock;
    private final Map<UUID, Long> lastUsedMillis;

    public TeleportCooldowns(Clock clock, Map<UUID, Long> restored) {
        this.clock = clock;
        this.lastUsedMillis = new ConcurrentHashMap<>(restored);
    }

    /** 剩餘冷卻；已結束或沒有紀錄回 {@link Duration#ZERO}。 */
    public Duration remaining(UUID playerId, Duration cooldown) {
        Long last = lastUsedMillis.get(playerId);
        if (last == null) return Duration.ZERO;
        Duration left = cooldown.minusMillis(clock.millis() - last);
        return left.isNegative() ? Duration.ZERO : left;
    }

    /** 傳送「成功」之後才呼叫；失敗不應吃掉玩家的冷卻。 */
    public void mark(UUID playerId) {
        lastUsedMillis.put(playerId, clock.millis());
    }

    /** 不可變快照，供持久化（例如 onDisable 時寫檔）。 */
    public Map<UUID, Long> snapshot() {
        return Map.copyOf(lastUsedMillis);
    }
}
```

### `TeleportSettings.java`

```java
package com.example.teleport;

import java.time.Duration;

/** 不可變設定；非法值在建構時直接失敗。 */
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
 * 單一世界的預找落點池，只在主執行緒使用。
 *
 * <ul>
 *   <li>分步補點：一次只跑一個搜尋，完成後隔 {@code STEP_DELAY_TICKS} 再補下一個，不一次吃光 tick 預算</li>
 *   <li>一次性：{@link #take} 先把點移出池再重驗，同一個點不可能發給兩個人（同 tick 也不會）</li>
 *   <li>每個池內點的區塊掛 plugin chunk ticket，取用時區塊必定已載入、重驗不讀盤；取出後下一 tick 才釋放</li>
 *   <li>世代計數：{@link #close} 之後回來的搜尋結果一律丟棄</li>
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

    /** 容量 0 的池：永遠取不到、不補點，用於「不使用池」。 */
    public static SafeSpotPool disabled(Plugin plugin, SafeSpotFinder finder, TeleportSettings settings) {
        return new SafeSpotPool(plugin, finder, new UUID(0L, 0L), settings, 0);
    }

    public void start() {
        refill();
    }

    /** 取一個重驗過的落點；池空或全部失效回 empty。不論結果都會觸發補點。 */
    public Optional<Location> take(World world) {
        requireMainThread();
        Optional<Location> result = Optional.empty();
        if (!closed && world.getUID().equals(worldId)) {
            while (result.isEmpty() && !spots.isEmpty()) {
                PooledSpot spot = spots.pollFirst();   // 先移出池 → 一次性
                releaseNextTick(spot);
                result = SafeLocationRules.evaluate(world, spot.x(), spot.z()); // 地形可能已被改建
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
            if (!holdsChunk(spot.chunkX(), spot.chunkZ())) { // 同區塊不重複存，避免兩人落在一起
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

    /** 下一 tick 才放 ticket：取用當下玩家還沒抵達。那時池裡若有同區塊的點就不放。 */
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
 * 暖機 → 找點（池優先）→ 重驗 → teleportAsync → 收尾。只在主執行緒呼叫。
 *
 * <p>每個非同步階段回來都重新驗證：玩家仍在線、閘門（戰鬥）仍放行、玩家所在世界與請求時相同。
 * 冷卻只在傳送成功後才記錄。
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

    /** 隨機傳送到 target 世界。 */
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

    /** 由 {@link WarmupListener} 呼叫：離開起點超過容許範圍就取消暖機。 */
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

        // 搜尋到現在可能過了幾個 tick，傳送前再判一次
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

    /** 每個非同步階段回來都呼叫：在線、閘門放行、世界沒變。 */
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
        if (!event.hasChangedBlock()) return; // 只轉頭不算移動，也省掉每 tick 的計算
        service.cancelIfMoved(event.getPlayer(), event.getTo());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        service.cancelWarmup(event.getPlayer().getUniqueId());
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/teleport/
├── SafeLocationRules.java      ← 無狀態判定（RTP／家／配對共用）
├── SafeSpotFinder.java         ← 非同步找點
├── SafeSpotPool.java           ← 預找落點池（可選）
├── TeleportGuard.java          ← 戰鬥等閘門
├── TeleportCooldowns.java
├── TeleportSettings.java
├── SafeTeleportService.java
├── WarmupListener.java
└── TeleportPlugin.java         ← 組裝（見 examples.md）
```

## 執行緒安全注意事項 / Thread Safety

- `getChunkAtAsync` 的 future 與 `teleportAsync` 的完成回呼都應視為「回到主執行緒」；範本仍用 `onMain` 保底，並在 `plugin.isEnabled()` 為 false 時放棄（停用中 `runTask` 會丟 `IllegalPluginAccessException`）
- 非同步階段之間只攜帶 `UUID`，回來後重新 `getPlayer` / `getWorld`，不持有 `Player` 引用
- 讀方塊（`SafeLocationRules`）、`WorldBorder`、`addPluginChunkTicket` 一律在主執行緒
- 池與暖機表只在主執行緒存取，不需要鎖；冷卻表用 `ConcurrentHashMap`，因為持久化可能在其他執行緒讀快照
- 詳見 [`Skills/_shared/paper-threading.md`](../../_shared/paper-threading.md)
- 戰鬥中禁止傳送：以 `TeleportGuard.blockWhileTagged` 接入 [`paper-combat-tag`](../paper-combat-tag/SKILL.md)

## 失敗回退 / Fallback

| 問題 | 原因 | 解法 |
|------|------|------|
| 一直找不到點 | 範圍內多海洋／岩漿，或 `max_attempts` 太小 | 調整半徑、提高次數；已有玩家訊息，不無限重試 |
| 傳進地下洞穴／樹頂 | 沒用 `MOTION_BLOCKING_NO_LEAVES` | 地上世界用範本的高度圖，不要自己從 y=319 往下掃 |
| 下界傳到屋頂或卡進岩盤 | 直接用最高方塊 | `hasCeiling()` 世界從 `logicalHeight - 8` 往下掃 |
| 傳到邊界外 | 忘記檢查 `WorldBorder#isInside` | 判定規則已含；自訂規則時務必保留 |
| 站進火或甜漿果叢 | 只判斷「可通行」 | 頭頂各格也比對危險清單 |
| 兩人同 tick 傳到同一點 | 池沒有一次性取用 | `take` 先移出再重驗；同區塊不重複入池 |
| 暖機期間進入戰鬥仍被傳走 | 只在指令開頭檢查閘門 | 每個階段回來都 `guard.denyReason` |
| 玩家登出後 NPE | 持有 `Player` 引用 | 只傳 UUID，回來重取並檢查 `isOnline()` |
| 重啟後冷卻消失 | 冷卻只在記憶體 | `snapshot()` 持久化，啟動時傳入 `restored` |
| 池的區塊被卸載 | 沒掛 chunk ticket | `addPluginChunkTicket`；`close()` 時 `removePluginChunkTickets` |
