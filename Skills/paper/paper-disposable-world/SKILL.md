---
name: paper-disposable-world
description: "拋棄式世界與可重置競技場：VoidChunkGenerator、WorldCreator、流水號命名與 level.dat 守衛、非同步複製模板、卸載後最後才刪 level.dat、預產生池，以及就地還原（變更格子基準表分批還原 + 殘留實體清掃）/ Throw-away Paper worlds and resettable arenas: void generator, serial naming with level.dat guard, async template copy, safe unload and delete, pre-generated pool, and budgeted in-place reset with debris sweep"
---

# Paper Disposable World / 拋棄式世界與競技場重置

## 技能名稱 / Skill Name

`paper-disposable-world`

## 目的 / Purpose

小遊戲、決鬥、副本需要「用完就丟」的世界，或每場結束要還原的競技場。本技能提供兩條路線：

1. **換世界**：從模板資料夾複製出 `arena_<n>`，載入、使用、卸載、刪除；可預先產生一池閒置世界。
2. **就地還原**：不換世界，記錄一場比賽改過哪些方塊，結束時每 tick 以預算分批還原，並清掉殘留實體。

兩條路線都遵守同一條原則：**世界操作只在主執行緒，只有檔案 IO（複製、刪除）放到非同步**。

最危險的靜默失敗有三個，範本都已防住：

- `WorldCreator` 碰到不存在或殘缺的資料夾會**默默生成一張新地形** → 先檢查資料夾與 `level.dat`
- 刪到一半當機，留下沒有 `level.dat` 的殘骸，之後被誤認為世界 → **`level.dat` 最後才刪**（複製時也是最後才寫）
- 世界還有玩家就卸載 → 先把玩家傳走、確認後才 `unloadWorld`

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2；純 Paper API，不需要 Paperweight
- **GameRule**：`org.bukkit.GameRule` 的舊常數（`DO_DAYLIGHT_CYCLE`、`DO_MOB_SPAWNING` 等）在兩版都已標 `@Deprecated`，原版規則改成 snake_case 的 registry key（`advance_time`、`spawn_mobs`…）。本範本一律走 `Registry.GAME_RULE.get(NamespacedKey.minecraft(key))`，兩版相同，也不依賴舊常數；查不到的 key 只記警告、不讓整個世界建立失敗
- `ChunkGenerator.shouldGenerate*()`、`WorldCreator.keepSpawnLoaded(TriState)`、`Block.getBlockKey(x, y, z)` 兩版簽名相同（javap 核對）

## 觸發條件 / Triggers

- 「拋棄式世界」「臨時世界」「競技場重置」「arena reset」「disposable world」「temporary world」
- 「WorldCreator」「複製世界模板」「copy world folder」「unloadWorld」「刪除世界資料夾」
- 「虛空世界」「void generator」「ChunkGenerator」「遊戲規則」「GameRule」
- 「還原方塊」「baseline」「changed blocks」「殘留實體」「掉落物清理」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `base_package` | `com.example.arena` | 範本所在 package |
| `name_prefix` | `arena_` | 世界資料夾前綴（**保留給本機制，勿與正式世界同名**） |
| `template_folder` | `plugins/Arena/templates/duel_map` | 模板世界資料夾（含 `level.dat`） |
| `pool_size` | `2` | 預先產生的閒置世界數 |
| `reset_mode` | `swap` / `in-place` | 換世界，或就地還原 |
| `blocks_per_tick` / `nanos_per_tick` | `2000` / `2_000_000` | 就地還原每 tick 的方塊數與時間預算 |

## 輸出產物 / Outputs

- `VoidChunkGenerator.java` — 什麼都不生成的區塊生成器
- `ArenaNames.java` — 流水號命名（回頭使用、跳過佔用）
- `ArenaRules.java` — 建立後立刻套用的遊戲規則
- `WorldFolders.java` — 複製模板（略過 `uid.dat`、`session.lock`）、刪除（`level.dat` 最後）
- `DisposableWorlds.java` — 建立／複製／卸載／刪除的主流程
- `ArenaPool.java` — 預產生世界池
- `ChangeRecorder.java` — 記錄被改過的方塊（基準表）
- `ArenaResetService.java` — 預算式分批還原
- `DebrisSweeper.java` — 殘留實體清掃（重置時全清 / 定時清）
- `ArenaPlugin.java` — 組裝與生命週期

## 建置設定 / Build Setup

見 [`Skills/paper-api/PLATFORM.md`](../../paper-api/PLATFORM.md)。只需要 `paper-api`：

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable' // 1.21.11：'1.21.11-R0.1-SNAPSHOT'
}
```

## 代碼範本 / Code Template

### `VoidChunkGenerator.java`

```java
package com.example.arena;

import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.generator.ChunkGenerator;

import java.util.Random;

/**
 * 什麼都不生成的世界（虛空）。
 *
 * <p>注意：自訂生成器**不會**寫進世界資料夾。每次載入既有世界（包含從模板複製出來的）都要再傳一次，
 * 否則新區塊會用原版地形生成，和舊區塊接不起來。
 */
public final class VoidChunkGenerator extends ChunkGenerator {

    @Override
    public boolean shouldGenerateNoise() {
        return false;
    }

    @Override
    public boolean shouldGenerateSurface() {
        return false;
    }

    @Override
    public boolean shouldGenerateBedrock() {
        return false;
    }

    @Override
    public boolean shouldGenerateCaves() {
        return false;
    }

    @Override
    public boolean shouldGenerateDecorations() {
        return false;
    }

    @Override
    public boolean shouldGenerateMobs() {
        return false;
    }

    @Override
    public boolean shouldGenerateStructures() {
        return false;
    }

    /** 固定出生點；沒有它，Paper 會在虛空裡搜尋一個「安全」的出生點而卡很久。 */
    @Override
    public Location getFixedSpawnLocation(World world, Random random) {
        return new Location(world, 0.5, 64.0, 0.5);
    }
}
```

### `ArenaNames.java`

```java
package com.example.arena;

import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * 流水號命名：{@code arena_1} … {@code arena_<max>}，到頂回到 1 並跳過仍被佔用的號碼。
 * 純邏輯，不碰 Bukkit；「佔用」由呼叫端的 predicate 判斷（已載入、已預約、資料夾已存在）。
 */
public final class ArenaNames {

    public static final String PREFIX = "arena_";
    private static final Pattern PATTERN = Pattern.compile("arena_\\d{1,6}");

    private final int max;
    private int cursor;

    public ArenaNames(int max) {
        if (max < 1 || max > 999_999) {
            throw new IllegalArgumentException("max must be in 1..999999: " + max);
        }
        this.max = max;
    }

    /** 刪除前的守衛：只有符合本機制命名的資料夾才允許被刪。 */
    public static boolean isArena(String worldName) {
        return PATTERN.matcher(worldName).matches();
    }

    public String next(Predicate<String> taken) {
        for (int i = 0; i < max; i++) {
            cursor = cursor % max + 1;
            String candidate = PREFIX + cursor;
            if (!taken.test(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("All " + max + " arena names are in use");
    }
}
```

### `ArenaRules.java`

```java
package com.example.arena;

import org.bukkit.Difficulty;
import org.bukkit.GameRule;
import org.bukkit.NamespacedKey;
import org.bukkit.Registry;
import org.bukkit.World;

import java.util.logging.Logger;

/**
 * 世界建立後**立刻**套用的設定（在任何玩家進入、任何 tick 之前）。
 *
 * <p>規則一律用 registry key 查（{@code advance_time}、{@code spawn_mobs}…），不用已棄用的
 * {@code GameRule.DO_DAYLIGHT_CYCLE} 等常數：舊常數會隨版本改名，key 查不到時只警告，不讓建立流程失敗。
 */
public final class ArenaRules {

    private final Logger logger;

    public ArenaRules(Logger logger) {
        this.logger = logger;
    }

    public void apply(World world) {
        world.setDifficulty(Difficulty.NORMAL);
        world.setAutoSave(false);          // 拋棄式：不要把區塊寫回磁碟
        world.setTime(6000L);
        world.setStorm(false);
        world.setThundering(false);

        setBoolean(world, "advance_time", false);          // 舊名 doDaylightCycle
        setBoolean(world, "advance_weather", false);       // 舊名 doWeatherCycle
        setBoolean(world, "spawn_mobs", false);            // 舊名 doMobSpawning
        setBoolean(world, "spawn_monsters", false);
        setBoolean(world, "mob_griefing", false);
        setBoolean(world, "keep_inventory", true);
        setBoolean(world, "immediate_respawn", true);
        setBoolean(world, "show_advancement_messages", false);
    }

    @SuppressWarnings("unchecked")
    private void setBoolean(World world, String key, boolean value) {
        GameRule<?> rule = Registry.GAME_RULE.get(NamespacedKey.minecraft(key));
        if (rule == null || rule.getType() != Boolean.class) {
            logger.warning("Unknown or non-boolean game rule '" + key + "'; skipped for " + world.getName());
            return;
        }
        world.setGameRule((GameRule<Boolean>) rule, value);
    }
}
```

### `WorldFolders.java`

```java
package com.example.arena;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * 世界資料夾的檔案操作。**全部是阻塞 IO，只能在非同步執行緒呼叫**（關服時例外）。
 */
public final class WorldFolders {

    /** uid.dat 讓兩個世界撞 UUID；session.lock 是原世界的鎖。複製時都不能帶。 */
    private static final Set<String> SKIP = Set.of("uid.dat", "session.lock");
    private static final String LEVEL_DAT = "level.dat";

    private WorldFolders() {
    }

    public static boolean hasLevelDat(Path folder) {
        return Files.isRegularFile(folder.resolve(LEVEL_DAT));
    }

    /** 複製模板；{@code level.dat} 最後才寫，所以複製到一半當機的資料夾不會被當成世界。 */
    public static void copyTemplate(Path template, Path target) throws IOException {
        if (!hasLevelDat(template)) {
            throw new IOException("Template has no level.dat: " + template);
        }
        if (Files.exists(target)) {
            throw new IOException("Target already exists: " + target);
        }
        Files.walkFileTree(template, new SimpleFileVisitor<Path>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                Files.createDirectories(target.resolve(template.relativize(dir).toString()));
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                String name = file.getFileName().toString();
                if (!SKIP.contains(name) && !LEVEL_DAT.equals(name)) {
                    Files.copy(file, target.resolve(template.relativize(file).toString()),
                            StandardCopyOption.COPY_ATTRIBUTES);
                }
                return FileVisitResult.CONTINUE;
            }
        });
        Files.copy(template.resolve(LEVEL_DAT), target.resolve(LEVEL_DAT), StandardCopyOption.COPY_ATTRIBUTES);
    }

    /**
     * 刪除世界資料夾，**{@code level.dat} 最後刪**：刪到一半當機時，殘骸沒有 level.dat，
     * 不會被 {@code WorldCreator} 或管理員誤認為一張可以載入的世界。
     */
    public static void deleteWorld(Path folder) throws IOException {
        if (!Files.exists(folder)) {
            return;
        }
        Path levelDat = folder.resolve(LEVEL_DAT);
        List<Path> paths;
        try (Stream<Path> walk = Files.walk(folder)) {
            paths = walk.sorted(Comparator.reverseOrder()).toList();   // 子項在前、資料夾在後
        }
        for (Path path : paths) {
            if (!path.equals(folder) && !path.equals(levelDat)) {
                Files.deleteIfExists(path);
            }
        }
        Files.deleteIfExists(levelDat);
        Files.deleteIfExists(folder);
    }
}
```

### `DisposableWorlds.java`

```java
package com.example.arena;

import net.kyori.adventure.util.TriState;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Server;
import org.bukkit.World;
import org.bukkit.WorldCreator;
import org.bukkit.entity.Player;
import org.bukkit.generator.ChunkGenerator;
import org.bukkit.plugin.Plugin;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.logging.Level;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 拋棄式世界的建立與銷毀。
 *
 * <p>執行緒：{@code createVoid}、{@code createFromTemplate}、{@code destroy} 必須在主執行緒呼叫；
 * 世界的載入／卸載一律在主執行緒；只有複製與刪除資料夾在非同步。回傳的 future 一律在主執行緒完成。
 * 本類別的欄位只在主執行緒讀寫，所以不需要鎖。
 */
public final class DisposableWorlds {

    private final Plugin plugin;
    private final Server server;
    private final ArenaNames names;
    private final ArenaRules rules;
    private final Path container;
    private final Set<String> owned = new LinkedHashSet<>();
    private final Set<String> reserved = new HashSet<>();

    public DisposableWorlds(Plugin plugin, ArenaNames names, ArenaRules rules) {
        this.plugin = plugin;
        this.server = plugin.getServer();
        this.names = names;
        this.rules = rules;
        this.container = server.getWorldContainer().toPath();
    }

    /** 建立一張虛空世界，中央放一格出生平台（實務上換成你的貼上流程）。 */
    public World createVoid() {
        requireMainThread();
        String name = names.next(this::taken);
        requireFresh(name);
        World world = load(name, new VoidChunkGenerator());
        world.getBlockAt(0, 63, 0).setType(Material.STONE);
        return world;
    }

    /**
     * 非同步複製模板，再於主執行緒載入。
     *
     * @param generator 模板若是虛空圖就傳 {@link VoidChunkGenerator}；原版地形傳 {@code null}
     */
    public CompletableFuture<World> createFromTemplate(Path template, ChunkGenerator generator) {
        requireMainThread();
        String name = names.next(this::taken);
        requireFresh(name);
        reserved.add(name);                      // 複製期間先佔住號碼，避免同一 tick 的第二次呼叫撞名
        Path target = container.resolve(name);
        CompletableFuture<World> pipeline = CompletableFuture
                .runAsync(() -> copy(template, target), this::async)
                .thenCompose(v -> onMain(() -> load(name, generator)));
        return finishOnMain(pipeline, () -> reserved.remove(name), failure -> async(() -> deleteQuietly(target)));
    }

    /** 把玩家傳走 → 確認沒人 → 卸載（不存檔）→ 非同步刪資料夾。 */
    public CompletableFuture<Void> destroy(World world) {
        requireMainThread();
        String name = world.getName();
        if (!owned.contains(name) || !ArenaNames.isArena(name)) {
            throw new IllegalArgumentException("Not a disposable world: " + name);
        }
        Location exit = server.getWorlds().get(0).getSpawnLocation();
        List<CompletableFuture<Boolean>> moves = world.getPlayers().stream()
                .map(player -> player.teleportAsync(exit)).toList();
        Path folder = world.getWorldFolder().toPath();
        CompletableFuture<Void> pipeline = CompletableFuture.allOf(moves.toArray(new CompletableFuture<?>[0]))
                .thenCompose(v -> onMain(() -> {
                    unload(world);
                    return null;
                }))
                .thenRunAsync(() -> deleteFolder(folder), this::async);
        return finishOnMain(pipeline, () -> { }, failure -> { });
    }

    /** 啟動時清掉上次當機留下的 arena_* 資料夾（前綴保留給本機制）。 */
    public void purgeStaleAsync() {
        Set<String> loaded = server.getWorlds().stream().map(World::getName).collect(Collectors.toSet());
        async(() -> {
            try (Stream<Path> dirs = Files.list(container)) {
                for (Path dir : dirs.filter(Files::isDirectory).toList()) {
                    String name = dir.getFileName().toString();
                    if (ArenaNames.isArena(name) && !loaded.contains(name)) {
                        deleteQuietly(dir);
                    }
                }
            } catch (IOException e) {
                plugin.getLogger().log(Level.WARNING, "Could not scan for stale arena folders", e);
            }
        });
    }

    /** onDisable 專用：scheduler 已不接受任務，所以同步卸載並刪除（關服時阻塞是可接受的）。 */
    public void closeAllSync() {
        Location exit = server.getWorlds().get(0).getSpawnLocation();
        for (String name : List.copyOf(owned)) {
            World world = server.getWorld(name);
            if (world == null) {
                owned.remove(name);
                continue;
            }
            Path folder = world.getWorldFolder().toPath();
            for (Player player : List.copyOf(world.getPlayers())) {
                player.teleport(exit);
            }
            if (server.unloadWorld(world, false)) {
                owned.remove(name);
                deleteQuietly(folder);
            }
        }
    }

    // ---- 內部 ----

    private boolean taken(String name) {
        return server.getWorld(name) != null || reserved.contains(name) || Files.exists(container.resolve(name));
    }

    /** 守衛：資料夾已存在就拒絕。WorldCreator 會把殘缺資料夾當成新世界默默生成地形。 */
    private void requireFresh(String name) {
        if (server.getWorld(name) != null) {
            throw new IllegalStateException("World already loaded: " + name);
        }
        Path folder = container.resolve(name);
        if (Files.exists(folder)) {
            String why = WorldFolders.hasLevelDat(folder)
                    ? "an existing world"
                    : "a folder without level.dat (half-deleted or foreign data)";
            throw new IllegalStateException("Refusing to create '" + name + "' over " + why);
        }
    }

    private World load(String name, ChunkGenerator generator) {
        World world = WorldCreator.name(name)
                .environment(World.Environment.NORMAL)
                .generator(generator)
                .generateStructures(false)
                .keepSpawnLoaded(TriState.FALSE)
                .createWorld();
        if (world == null) {
            throw new IllegalStateException("createWorld returned null for " + name);
        }
        rules.apply(world);                       // 建立後立刻套用，早於任何玩家與 tick
        owned.add(name);
        return world;
    }

    private void unload(World world) {
        if (!world.getPlayers().isEmpty()) {
            throw new IllegalStateException("Players still inside " + world.getName());
        }
        if (!server.unloadWorld(world, false)) {
            throw new IllegalStateException("unloadWorld refused for " + world.getName());
        }
        owned.remove(world.getName());
    }

    private void copy(Path template, Path target) {
        try {
            WorldFolders.copyTemplate(template, target);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void deleteFolder(Path folder) {
        try {
            WorldFolders.deleteWorld(folder);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void deleteQuietly(Path folder) {
        try {
            WorldFolders.deleteWorld(folder);
        } catch (IOException e) {
            plugin.getLogger().log(Level.WARNING, "Could not delete " + folder, e);
        }
    }

    private void async(Runnable task) {
        server.getScheduler().runTaskAsynchronously(plugin, task);
    }

    private <T> CompletableFuture<T> onMain(Supplier<T> task) {
        CompletableFuture<T> future = new CompletableFuture<>();
        server.getScheduler().runTask(plugin, () -> {
            try {
                future.complete(task.get());
            } catch (RuntimeException e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    /** 無論 pipeline 在哪個執行緒結束，都回到主執行緒才完成回傳的 future；失敗時先跑 onFailure。 */
    private <T> CompletableFuture<T> finishOnMain(CompletableFuture<T> pipeline, Runnable mainCleanup,
                                                  Consumer<Throwable> onFailure) {
        CompletableFuture<T> result = new CompletableFuture<>();
        pipeline.whenComplete((value, error) -> {
            if (error != null) {
                onFailure.accept(error);
            }
            server.getScheduler().runTask(plugin, () -> {
                mainCleanup.run();
                if (error == null) {
                    result.complete(value);
                } else {
                    result.completeExceptionally(error);
                }
            });
        });
        return result;
    }

    private void requireMainThread() {
        if (!server.isPrimaryThread()) {
            throw new IllegalStateException("DisposableWorlds must be used on the main thread");
        }
    }
}
```

### `ArenaPool.java`

```java
package com.example.arena;

import org.bukkit.World;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;

/**
 * 預先產生的閒置世界池。全部在主執行緒；複製在非同步，由 {@link DisposableWorlds} 負責，
 * 它的 future 一律在主執行緒完成，所以這裡不需要鎖。
 *
 * <p>補貨失敗後冷卻 {@value #FAILURE_COOLDOWN_MS} 毫秒，避免模板壞掉時每 5 秒狂複製、狂寫 log。
 */
public final class ArenaPool {

    private static final long FAILURE_COOLDOWN_MS = 60_000L;

    private final Plugin plugin;
    private final DisposableWorlds worlds;
    private final Path template;
    private final int target;
    private final Deque<World> idle = new ArrayDeque<>();
    private int pending;
    private long failedAtMillis;
    private BukkitTask refillTask;

    public ArenaPool(Plugin plugin, DisposableWorlds worlds, Path template, int target) {
        this.plugin = plugin;
        this.worlds = worlds;
        this.template = template;
        this.target = target;
    }

    public void start() {
        refillTask = plugin.getServer().getScheduler().runTaskTimer(plugin, this::refill, 20L, 100L);
    }

    /** 池空時回 empty：呼叫端應讓玩家排隊，不要在主執行緒同步等複製。 */
    public Optional<World> acquire() {
        return Optional.ofNullable(idle.pollFirst());
    }

    /** 用完歸還＝銷毀（拋棄式世界不重用）；補貨由計時器負責。 */
    public CompletableFuture<Void> release(World world) {
        return worlds.destroy(world);
    }

    public int idleCount() {
        return idle.size();
    }

    public void shutdown() {
        if (refillTask != null) {
            refillTask.cancel();
        }
        idle.clear();     // 世界本體由 DisposableWorlds.closeAllSync() 處理
    }

    private void refill() {
        if (System.currentTimeMillis() - failedAtMillis < FAILURE_COOLDOWN_MS) {
            return;
        }
        while (idle.size() + pending < target) {
            pending++;
            worlds.createFromTemplate(template, new VoidChunkGenerator()).whenComplete((world, error) -> {
                pending--;                       // 主執行緒
                if (error == null) {
                    idle.addLast(world);
                    return;
                }
                failedAtMillis = System.currentTimeMillis();
                plugin.getLogger().log(Level.WARNING, "Arena pre-generation failed; pausing refill", error);
            });
        }
    }
}
```

### `ChangeRecorder.java`

```java
package com.example.arena;

import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.block.BlockState;
import org.bukkit.block.data.BlockData;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockBurnEvent;
import org.bukkit.event.block.BlockExplodeEvent;
import org.bukkit.event.block.BlockFromToEvent;
import org.bukkit.event.block.BlockIgniteEvent;
import org.bukkit.event.block.BlockMultiPlaceEvent;
import org.bukkit.event.block.BlockPistonExtendEvent;
import org.bukkit.event.block.BlockPistonRetractEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.block.BlockSpreadEvent;
import org.bukkit.event.entity.EntityChangeBlockEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.player.PlayerBucketEmptyEvent;
import org.bukkit.event.player.PlayerBucketFillEvent;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 記錄「一場比賽改過哪些格子」的基準表：key＝{@code Block.getBlockKey(x, y, z)}，value＝**第一次被改之前**的 BlockData。
 * 同一格被改十次只記第一次（{@code putIfAbsent}），還原時寫回的就是比賽開始前的狀態。
 *
 * <p>全部在主執行緒（事件 handler 與還原都是）。用 {@link EventPriority#MONITOR}：
 * 事件已確定會生效，而且方塊還沒真的被改（放置事件用 replaced state 取舊值）。
 *
 * <p>超過 {@link #MAX_CELLS} 格代表這場破壞太大，基準表不再可信 → 標成 overflowed，
 * 呼叫端改走「換世界」路線。
 */
public final class ChangeRecorder implements Listener {

    public static final int MAX_CELLS = 500_000;

    private static final BlockFace[] ADJACENT = {
            BlockFace.UP, BlockFace.DOWN, BlockFace.NORTH, BlockFace.SOUTH, BlockFace.EAST, BlockFace.WEST
    };

    private final Map<UUID, Map<Long, BlockData>> baselines = new HashMap<>();
    private final Set<UUID> overflowed = new HashSet<>();

    public void track(World world) {
        baselines.putIfAbsent(world.getUID(), new HashMap<>());
    }

    public void untrack(World world) {
        baselines.remove(world.getUID());
        overflowed.remove(world.getUID());
    }

    public boolean overflowed(World world) {
        return overflowed.contains(world.getUID());
    }

    public int pending(World world) {
        Map<Long, BlockData> cells = baselines.get(world.getUID());
        return cells == null ? 0 : cells.size();
    }

    /** 取走目前的基準表（不可變副本）並開始記下一輪。 */
    public Map<Long, BlockData> drain(World world) {
        Map<Long, BlockData> cells = baselines.get(world.getUID());
        if (cells == null) {
            return Map.of();
        }
        Map<Long, BlockData> snapshot = Map.copyOf(cells);
        baselines.put(world.getUID(), new HashMap<>());
        return snapshot;
    }

    // ---- 記錄 ----

    private void record(Block block) {
        Map<Long, BlockData> cells = baselines.get(block.getWorld().getUID());
        if (cells != null) {
            put(block.getWorld(), cells, block.getBlockKey(), block.getBlockData());
        }
    }

    private void recordOriginal(Block position, BlockData original) {
        Map<Long, BlockData> cells = baselines.get(position.getWorld().getUID());
        if (cells != null) {
            put(position.getWorld(), cells, position.getBlockKey(), original);
        }
    }

    private void put(World world, Map<Long, BlockData> cells, long key, BlockData original) {
        if (cells.size() >= MAX_CELLS && !cells.containsKey(key)) {
            overflowed.add(world.getUID());
            return;
        }
        cells.putIfAbsent(key, original);
    }

    private void recordWithNeighbours(Block block) {
        record(block);
        for (BlockFace face : ADJACENT) {
            record(block.getRelative(face));      // 火把、門、植物會因為依附的方塊消失而掉落
        }
    }

    private void recordAll(List<Block> blocks) {
        for (Block block : blocks) {
            record(block);
        }
    }

    private void recordPiston(Block piston, BlockFace direction, List<Block> moved) {
        record(piston.getRelative(direction));
        for (Block block : moved) {
            record(block);
            record(block.getRelative(direction));
        }
    }

    // ---- 事件 ----

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent event) {
        recordOriginal(event.getBlock(), event.getBlockReplacedState().getBlockData());
        if (event instanceof BlockMultiPlaceEvent multi) {       // 床、門等多格方塊
            for (BlockState replaced : multi.getReplacedBlockStates()) {
                recordOriginal(replaced.getBlock(), replaced.getBlockData());
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        recordWithNeighbours(event.getBlock());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onEntityExplode(EntityExplodeEvent event) {
        recordAll(event.blockList());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockExplode(BlockExplodeEvent event) {
        recordAll(event.blockList());
    }

    /** 液體流動：被流到的那格。 */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onFlow(BlockFromToEvent event) {
        record(event.getToBlock());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBucketEmpty(PlayerBucketEmptyEvent event) {
        record(event.getBlock());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBucketFill(PlayerBucketFillEvent event) {
        record(event.getBlock());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBurn(BlockBurnEvent event) {
        record(event.getBlock());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onIgnite(BlockIgniteEvent event) {
        record(event.getBlock());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onSpread(BlockSpreadEvent event) {
        record(event.getBlock());
    }

    /** 沙子落下、終界使者搬方塊、凋零破壞等。 */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onEntityChangeBlock(EntityChangeBlockEvent event) {
        record(event.getBlock());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPistonExtend(BlockPistonExtendEvent event) {
        recordPiston(event.getBlock(), event.getDirection(), event.getBlocks());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPistonRetract(BlockPistonRetractEvent event) {
        recordPiston(event.getBlock(), event.getDirection(), event.getBlocks());
    }
}
```

### `DebrisSweeper.java`

```java
package com.example.arena;

import org.bukkit.GameMode;
import org.bukkit.Tag;
import org.bukkit.World;
import org.bukkit.entity.AreaEffectCloud;
import org.bukkit.entity.EnderCrystal;
import org.bukkit.entity.Entity;
import org.bukkit.entity.ExperienceOrb;
import org.bukkit.entity.FallingBlock;
import org.bukkit.entity.Item;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.entity.minecart.ExplosiveMinecart;

import java.util.List;

/**
 * 殘留實體清掃：方塊還原不會還原實體，掉落物、箭、TNT 礦車會留到下一場。
 *
 * <p>兩種模式：
 * <ul>
 *   <li>{@link #sweepAll}：重置時全清，**包含**界伏盒物品（比賽結束了，玩家的東西也不留）</li>
 *   <li>{@link #sweepStale}：定時清理（比賽進行中），只清活夠久且附近沒人的；
 *       <b>豁免</b>已點燃的 TNT 礦車（遠處點燃的不能「點了沒反應」）和界伏盒物品
 *       （被炸掉的界伏盒內容會一起掉出來，那是玩家的東西）</li>
 * </ul>
 * 只掃已載入的實體，不為了清理去載入區塊。主執行緒呼叫。
 */
public final class DebrisSweeper {

    private static final List<Class<? extends Entity>> TYPES = List.of(
            Item.class, Projectile.class, ExplosiveMinecart.class, TNTPrimed.class,
            EnderCrystal.class, ExperienceOrb.class, FallingBlock.class, AreaEffectCloud.class);
    private static final long MILLIS_PER_TICK = 50L;

    public int sweepAll(World world) {
        int removed = 0;
        for (Entity entity : entities(world)) {
            entity.remove();
            removed++;
        }
        return removed;
    }

    public int sweepStale(World world, long ttlMillis, double safeRadius) {
        List<Player> present = world.getPlayers().stream()
                .filter(player -> player.getGameMode() != GameMode.SPECTATOR).toList();
        int removed = 0;
        for (Entity entity : entities(world)) {
            if (exempt(entity)) {
                continue;
            }
            long ageMillis = entity.getTicksLived() * MILLIS_PER_TICK;
            if (ageMillis >= ttlMillis && nearest(entity, present) >= safeRadius) {
                entity.remove();
                removed++;
            }
        }
        return removed;
    }

    private static boolean exempt(Entity entity) {
        if (entity instanceof ExplosiveMinecart cart && cart.isIgnited()) {
            return true;
        }
        return entity instanceof Item item && Tag.SHULKER_BOXES.isTagged(item.getItemStack().getType());
    }

    private static double nearest(Entity entity, List<Player> players) {
        double best = Double.POSITIVE_INFINITY;
        for (Player player : players) {
            best = Math.min(best, player.getLocation().distanceSquared(entity.getLocation()));
        }
        return Math.sqrt(best);
    }

    private static List<Entity> entities(World world) {
        return List.copyOf(world.getEntitiesByClasses(TYPES.toArray(new Class<?>[0])));
    }
}
```

### `ArenaResetService.java`

```java
package com.example.arena;

import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.data.BlockData;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * 就地還原：把 {@link ChangeRecorder} 記下的格子，每 tick 在**預算內**寫回去，最後清殘留實體。
 *
 * <p>預算有兩層：每 tick 最多 {@code maxBlocksPerTick} 格，以及 {@code maxNanosPerTick} 的時間上限
 * （每 64 格檢查一次時鐘）。一次寫太多會拖慢整個伺服器的 tick，而不只是這個競技場。
 *
 * <p>還原用 {@code setBlockData(data, false)}（不觸發方塊物理），所以不會再產生事件、
 * 不會被 {@link ChangeRecorder} 重複記錄。還原期間請先把玩家移出競技場。主執行緒呼叫。
 */
public final class ArenaResetService {

    private final Plugin plugin;
    private final ChangeRecorder recorder;
    private final DebrisSweeper sweeper;
    private final int maxBlocksPerTick;
    private final long maxNanosPerTick;
    private final Set<UUID> running = new HashSet<>();

    public ArenaResetService(Plugin plugin, ChangeRecorder recorder, DebrisSweeper sweeper,
                             int maxBlocksPerTick, long maxNanosPerTick) {
        this.plugin = plugin;
        this.recorder = recorder;
        this.sweeper = sweeper;
        this.maxBlocksPerTick = maxBlocksPerTick;
        this.maxNanosPerTick = maxNanosPerTick;
    }

    /** @return 完成時的還原格數；基準表溢位或已在還原中則以例外完成（請改走換世界）。 */
    public CompletableFuture<Integer> reset(World world) {
        if (!plugin.getServer().isPrimaryThread()) {
            throw new IllegalStateException("reset must be called on the main thread");
        }
        CompletableFuture<Integer> done = new CompletableFuture<>();
        if (recorder.overflowed(world)) {
            done.completeExceptionally(new IllegalStateException("Baseline overflowed; recycle the world instead"));
            return done;
        }
        if (!running.add(world.getUID())) {
            done.completeExceptionally(new IllegalStateException("Reset already running for " + world.getName()));
            return done;
        }
        Map<Long, BlockData> baseline = recorder.drain(world);
        // 依 key 排序＝依座標分群，連續寫同一個區塊，比 HashMap 的隨機順序快
        long[] keys = baseline.keySet().stream().mapToLong(Long::longValue).sorted().toArray();
        plugin.getServer().getScheduler().runTaskTimer(plugin, new Job(world, keys, baseline, done), 1L, 1L);
        return done;
    }

    private final class Job implements Consumer<BukkitTask> {
        private final World world;
        private final long[] keys;
        private final Map<Long, BlockData> baseline;
        private final CompletableFuture<Integer> done;
        private int cursor;

        private Job(World world, long[] keys, Map<Long, BlockData> baseline, CompletableFuture<Integer> done) {
            this.world = world;
            this.keys = keys;
            this.baseline = baseline;
            this.done = done;
        }

        @Override
        public void accept(BukkitTask task) {
            if (plugin.getServer().getWorld(world.getUID()) == null) {
                finish(task, new IllegalStateException("World unloaded during reset"));
                return;
            }
            long deadline = System.nanoTime() + maxNanosPerTick;
            int written = 0;
            while (cursor < keys.length && written < maxBlocksPerTick) {
                if ((cursor & 63) == 0 && System.nanoTime() > deadline) {
                    break;
                }
                long key = keys[cursor++];
                Block block = world.getBlockAt(Block.getBlockKeyX(key), Block.getBlockKeyY(key), Block.getBlockKeyZ(key));
                BlockData original = baseline.get(key);
                if (!block.getBlockData().equals(original)) {
                    block.setBlockData(original, false);
                    written++;
                }
            }
            if (cursor >= keys.length) {
                sweeper.sweepAll(world);          // 方塊還原完才清實體，避免清完又有新的掉出來
                finish(task, null);
            }
        }

        private void finish(BukkitTask task, Throwable error) {
            task.cancel();
            running.remove(world.getUID());
            if (error == null) {
                done.complete(keys.length);
            } else {
                done.completeExceptionally(error);
            }
        }
    }
}
```

### `ArenaPlugin.java`

```java
package com.example.arena;

import org.bukkit.plugin.java.JavaPlugin;

import java.nio.file.Path;

public final class ArenaPlugin extends JavaPlugin {

    private static final int MAX_ARENAS = 9_999;
    private static final int POOL_SIZE = 2;
    private static final int BLOCKS_PER_TICK = 2_000;
    private static final long NANOS_PER_TICK = 2_000_000L;     // 2 ms

    private DisposableWorlds worlds;
    private ArenaPool pool;
    private ChangeRecorder recorder;
    private ArenaResetService resets;

    @Override
    public void onEnable() {
        worlds = new DisposableWorlds(this, new ArenaNames(MAX_ARENAS), new ArenaRules(getLogger()));
        worlds.purgeStaleAsync();

        Path template = getDataFolder().toPath().resolve("templates").resolve("duel_map");
        pool = new ArenaPool(this, worlds, template, POOL_SIZE);
        pool.start();

        recorder = new ChangeRecorder();
        getServer().getPluginManager().registerEvents(recorder, this);
        resets = new ArenaResetService(this, recorder, new DebrisSweeper(), BLOCKS_PER_TICK, NANOS_PER_TICK);
    }

    @Override
    public void onDisable() {
        pool.shutdown();
        worlds.closeAllSync();
    }

    public DisposableWorlds worlds() {
        return worlds;
    }

    public ArenaPool pool() {
        return pool;
    }

    public ChangeRecorder recorder() {
        return recorder;
    }

    public ArenaResetService resets() {
        return resets;
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/arena/
├── ArenaPlugin.java
├── world/                       ← 換世界路線
│   ├── DisposableWorlds.java
│   ├── ArenaPool.java
│   ├── ArenaNames.java
│   ├── ArenaRules.java
│   ├── WorldFolders.java        ← 唯一做阻塞檔案 IO 的類別
│   └── VoidChunkGenerator.java
└── reset/                       ← 就地還原路線
    ├── ChangeRecorder.java
    ├── ArenaResetService.java
    └── DebrisSweeper.java
plugins/Arena/templates/duel_map/   ← 模板世界（含 level.dat、region/）
```

（上面範本為了單檔可編譯都放在 `com.example.arena`；實際專案可依此結構拆 package。）

## 選擇路線 / Choosing a Route

| | 換世界（copy + unload + delete） | 就地還原（record + restore） |
|---|---|---|
| 適合 | 大型破壞、方塊實體內容重要、場地很大 | 小場地、破壞量有限、要快速連打 |
| 每場成本 | 複製一份資料夾（可預產生掩蓋） | 與「被改格數」成正比 |
| 還原完整度 | 完整（連箱子內容、區塊實體） | 只還原方塊型態；容器內容、告示牌文字、頭顱需另外處理 |
| 風險 | 磁碟空間、Windows 檔案鎖 | 漏記的變更來源（見失敗回退） |
| 溢位處理 | — | `overflowed` → 退回換世界 |

兩條路線可並用：平常就地還原，`ChangeRecorder.overflowed(world)` 為真時銷毀並從池領一張新的。

## NMS 快速路徑 / NMS Fast Path

就地還原的瓶頸是 `Block#setBlockData` 每格一次的 Bukkit 包裝與光照更新。格子數很大（數十萬）時，改用直接寫 `LevelChunk` / `LevelChunkSection` 再統一重算光照與通知客戶端，見 [`nms-chunk-access`](../../nms/nms-chunk-access/SKILL.md)。Paper API 版本已足夠大多數小遊戲；不要為了「可能很大」而預先引入 Paperweight。

## 執行緒安全注意事項 / Thread Safety

| 操作 | 執行緒 |
|------|-------|
| `WorldCreator.createWorld()`、`unloadWorld`、`setGameRule`、`teleportAsync` 呼叫 | **主執行緒** |
| `getBlockAt` / `setBlockData` / `getEntitiesByClasses` / `remove()` | **主執行緒** |
| `ChangeRecorder` 的事件與 `drain` | 主執行緒（欄位不需鎖） |
| `WorldFolders.copyTemplate` / `deleteWorld` | **非同步**（阻塞 IO）；關服時 `closeAllSync` 例外 |
| `teleportAsync` 的完成回呼 | 主執行緒（Paper 保證），但仍要重新驗證世界還在 |

- 非同步 lambda 只攜帶 `Path` / `String`，不攜帶 `World`、`Player`
- 回傳的 future 一律在主執行緒完成，呼叫端可直接碰 Bukkit 物件
- `onDisable` 時 scheduler 不再接受新任務：用 `closeAllSync()` 同步收尾，不要再 `runTask`
- 詳見 [`Skills/_shared/paper-threading.md`](../../_shared/paper-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 重啟後世界變成空白新圖 | 資料夾被刪掉，`WorldCreator` 默默生成新地形 | 載入前檢查 `level.dat`；`requireFresh` 拒絕蓋在殘缺資料夾上 |
| 殘骸資料夾被當成世界載入 | 刪除時 `level.dat` 先被刪（或複製時先被寫） | 刪除最後刪、複製最後寫 `level.dat`；啟動時 `purgeStaleAsync` |
| 兩個世界 UUID 衝突／`session.lock` 錯誤 | 複製了 `uid.dat`、`session.lock` | `WorldFolders` 的 `SKIP` 清單 |
| 載入複製出的世界後地形變成原版 | 自訂生成器沒有隨世界保存 | 每次載入都傳 `generator(...)` |
| `unloadWorld` 回 false | 世界還有玩家、或是預設世界 | 先 `teleportAsync` 傳走並確認 `getPlayers().isEmpty()`；永遠不要卸載 `getWorlds().get(0)` |
| Windows 上刪資料夾丟 `AccessDeniedException` | 區域檔剛卸載、檔案鎖尚未釋放 | 延遲數秒重試刪除；啟動時 `purgeStaleAsync` 補刪 |
| `All N arena names are in use` | 世界沒被銷毀（洩漏） | 檢查所有結束路徑都呼叫 `destroy`；調大 `max` |
| 遊戲規則沒生效／log 警告 unknown rule | 版本間 key 改名 | 用 `javap` 或 `Registry.GAME_RULE` 列出 key 核對；舊常數已棄用，不要用 |
| 還原後仍有漏網的方塊 | 變更來源沒被事件涵蓋（命令方塊、其他插件直接改方塊） | 其他插件的改動不會觸發事件 → 該場地改走換世界；或另掃區域與基準比對 |
| 還原後箱子／界伏盒內容是空的 | 基準表只記 `BlockData` | 需要容器內容時改走換世界，或另外記 `TileState` 快照 |
| 還原讓伺服器卡頓 | 預算太大 | 調小 `maxBlocksPerTick` / `maxNanosPerTick`；超大場地改用 `nms-chunk-access` |
| 殘留箭、TNT 礦車、掉落物 | 實體不是方塊 | 重置時 `DebrisSweeper.sweepAll`；比賽中用 `sweepStale` 定時清 |
