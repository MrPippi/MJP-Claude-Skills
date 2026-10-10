---
name: paper-sqlite-repository
description: "Paper 插件的 SQLite 持久化：單一連線（WAL、busy_timeout、foreign_keys）、PRAGMA user_version 遷移、Repository 介面與 PreparedStatement 實作、單一寫入執行緒的 write-behind、onDisable 同步落盤 / SQLite persistence for Paper plugins with versioned migrations, a Bukkit-free repository, and a single-writer write-behind flusher"
---

# Paper SQLite Repository / SQLite 持久化

## 技能名稱 / Skill Name

`paper-sqlite-repository`

## 目的 / Purpose

給 Paper 插件一套小而可靠的 SQLite 持久化骨架：

- **一條連線、一個寫入執行緒**：SQLite 同一時間只有一個寫入者，與其用連線池，不如用一條連線加 WAL 與 `busy_timeout`。
- **版本化遷移**：用 `PRAGMA user_version` 記錄已套用的步驟數，步驟只能往後加，已發布的步驟不得重排或修改。
- **Repository 介面不含 Bukkit**：領域型別只用 JDK 型別，實作只用 `PreparedStatement`，因此可以用 `jdbc:sqlite::memory:` 直接單元測試，不需要 MockBukkit。
- **write-behind**：主執行緒只改記憶體並標記 dirty，由單一執行緒批次寫入；`onDisable` 時排程器已關閉，必須同步落盤。

本技能的範例領域是「玩家家（home）」。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（只用 Bukkit 排程器與 JDBC，兩版相同）
- 純 Paper API，不需要 Paperweight
- 驅動 `org.xerial:sqlite-jdbc` 含 JNI 原生函式庫，**不要 shade／relocate**，改由 `plugin.yml` 的 `libraries:` 讓伺服器下載

## 觸發條件 / Triggers

- 「SQLite」「資料庫」「持久化」「persistence」「repository」
- 「schema 遷移」「migration」「user_version」「資料表升級」
- 「write-behind」「非同步存檔」「寫入執行緒」「onDisable 存檔」
- 「sqlite-jdbc」「WAL」「SQLITE_BUSY」「database is locked」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `base_package` | `com.example.homes` | 插件根 package |
| `domain_type` | `Home` | 領域型別（record，只用 JDK 型別） |
| `table` | `homes` | 資料表名稱 |
| `db_file` | `homes.db` | 放在 `getDataFolder()` 下的檔名 |
| `write_mode` | `write-behind` / `write-through` | 寫入策略；高頻更新用 write-behind |

## 輸出產物 / Outputs

- `DataAccessException.java` — 資料存取的 unchecked 例外
- `SqliteDatabase.java` — 單一連線的開關與 pragma
- `SchemaMigrations.java` — 依 `user_version` 逐步遷移，每步一個交易
- `HomeSchema.java` — 這個插件的有序遷移步驟
- `Home.java` / `HomeRepository.java` — 領域型別與介面（無 Bukkit）
- `SqliteHomeRepository.java` — `PreparedStatement` 實作
- `HomeFlusher.java` — dirty map + 單一寫入執行緒
- `HomeService.java` — 非同步讀取、結果回主執行緒
- `HomesPlugin.java` — 生命週期接線與 `onDisable` 同步 flush

## 建置設定 / Build Setup

見 [`references/paper-api-platform.md`](references/paper-api-platform.md)。驅動只用 `compileOnly`，不打包：

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
    compileOnly 'org.xerial:sqlite-jdbc:3.49.1.0'
    testImplementation 'org.xerial:sqlite-jdbc:3.49.1.0'
    testImplementation platform('org.junit:junit-bom:5.11.4')
    testImplementation 'org.junit.jupiter:junit-jupiter'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}
test { useJUnitPlatform() }
```

`plugin.yml`（`libraries:` 只有 `plugin.yml` 支援；`paper-plugin.yml` 要改用 `PluginLoader`）：

```yaml
name: Homes
main: com.example.homes.HomesPlugin
api-version: '26.2'
libraries:
  - org.xerial:sqlite-jdbc:3.49.1.0
```

## 代碼範本 / Code Template

### `DataAccessException.java`

```java
package com.example.homes.persistence;

/** 資料存取失敗。unchecked，讓 onEnable 的 catch 與非同步任務的錯誤處理都接得到。 */
public final class DataAccessException extends RuntimeException {

    public DataAccessException(String message) {
        super(message);
    }

    public DataAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

### `SqliteDatabase.java`

```java
package com.example.homes.persistence;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

import org.slf4j.Logger;

/**
 * 一個 SQLite 資料庫的連線生命週期：開、交出連線、關。不碰 SQL，也不是執行緒安全的——
 * 由持有它的 Repository 決定怎麼序列化存取（本範本用 {@code synchronized}）。
 */
public final class SqliteDatabase {

    private final String jdbcUrl;
    private final Path file;
    private final Logger logger;

    private Connection connection;

    /** 檔案資料庫；父目錄不存在時 {@link #open()} 會建立。 */
    public SqliteDatabase(Path file, Logger logger) {
        this.file = file.toAbsolutePath();
        this.jdbcUrl = "jdbc:sqlite:" + this.file;
        this.logger = logger;
    }

    private SqliteDatabase(Logger logger) {
        this.file = null;
        this.jdbcUrl = "jdbc:sqlite::memory:";
        this.logger = logger;
    }

    /** 測試用：{@code jdbc:sqlite::memory:}，每條連線一個獨立資料庫（所以只能用單一連線）。 */
    public static SqliteDatabase inMemory(Logger logger) {
        return new SqliteDatabase(logger);
    }

    /**
     * 開連線並套用 pragma。
     * <ul>
     *   <li>{@code journal_mode=WAL}：讀不必等寫（記憶體資料庫會忽略）</li>
     *   <li>{@code busy_timeout=3000}：拿不到鎖時等三秒，而不是立刻丟 SQLITE_BUSY</li>
     *   <li>{@code foreign_keys=ON}：SQLite 預設關閉，且是每條連線各自的設定</li>
     * </ul>
     */
    public void open() {
        if (isOpen()) {
            return;
        }
        try {
            if (file != null && file.getParent() != null) {
                Files.createDirectories(file.getParent());
            }
            // 明確載入驅動，失敗時的訊息比 "No suitable driver" 直接
            Class.forName("org.sqlite.JDBC");
            Connection opened = DriverManager.getConnection(jdbcUrl);
            try (Statement stmt = opened.createStatement()) {
                stmt.execute("PRAGMA journal_mode=WAL");
                stmt.execute("PRAGMA busy_timeout=3000");
                stmt.execute("PRAGMA foreign_keys=ON");
            }
            this.connection = opened;
        } catch (ClassNotFoundException | IOException | SQLException e) {
            throw new DataAccessException("Failed to open database " + jdbcUrl, e);
        }
    }

    /** 開著的連線。每次使用都經過這裡，不要存成欄位（close 之後的延遲任務會拿到已關閉的連線）。 */
    public Connection connection() {
        if (connection == null) {
            throw new DataAccessException("Database is closed: " + jdbcUrl);
        }
        return connection;
    }

    public boolean isOpen() {
        if (connection == null) {
            return false;
        }
        try {
            return !connection.isClosed();
        } catch (SQLException e) {
            return false;
        }
    }

    /** 對「從沒開過」與「已經關過」都安全，onEnable 半路失敗時走的就是這條。 */
    public void close() {
        if (connection == null) {
            return;
        }
        try {
            connection.close();
        } catch (SQLException e) {
            logger.warn("Error while closing database {}", jdbcUrl, e);
        } finally {
            connection = null;
        }
    }
}
```

### `SchemaMigrations.java`

```java
package com.example.homes.persistence;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

import org.slf4j.Logger;

/**
 * 依 {@code PRAGMA user_version} 套用有序遷移。
 *
 * <p>規則：步驟列表只能<b>往後加</b>，已發布的步驟不得重排、修改或刪除；
 * 第 N 個步驟（從 0 起算）成功後 user_version 變成 N+1。每個步驟在一個交易內，
 * 失敗就 rollback，資料庫停在上一個完整版本。
 */
public final class SchemaMigrations {

    private SchemaMigrations() {
    }

    /** 一個遷移步驟：一組要依序執行的 SQL。 */
    public record Step(List<String> sql) {

        public Step {
            sql = List.copyOf(sql);
        }

        public static Step of(String... sql) {
            return new Step(List.of(sql));
        }
    }

    /** 把資料庫升級到 {@code steps.size()}。資料庫版本比程式新時拒絕啟動，避免降級毀資料。 */
    public static void run(Connection connection, List<Step> steps, Logger logger) throws SQLException {
        int current = currentVersion(connection);
        if (current > steps.size()) {
            throw new SQLException("Database schema version " + current
                + " is newer than this plugin supports (" + steps.size() + "). Update the plugin.");
        }
        for (int v = current; v < steps.size(); v++) {
            apply(connection, steps.get(v), v);
            logger.info("Database migrated to schema version {}", v + 1);
        }
    }

    private static void apply(Connection connection, Step step, int index) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try (Statement stmt = connection.createStatement()) {
            for (String sql : step.sql()) {
                stmt.executeUpdate(sql);
            }
            // PRAGMA 不能綁定參數；index 是我們自己的整數，不是外部輸入
            stmt.executeUpdate("PRAGMA user_version = " + (index + 1));
            connection.commit();
        } catch (SQLException e) {
            try {
                connection.rollback();
            } catch (SQLException rollbackFailure) {
                e.addSuppressed(rollbackFailure);
            }
            throw e;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    public static int currentVersion(Connection connection) throws SQLException {
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery("PRAGMA user_version")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }
}
```

### `HomeSchema.java`

```java
package com.example.homes.persistence;

import java.util.List;

/** 這個插件的遷移步驟。只能往後加；要改欄位就新增一個步驟，不要改舊步驟。 */
public final class HomeSchema {

    private HomeSchema() {
    }

    public static final List<SchemaMigrations.Step> STEPS = List.of(
        // v1
        SchemaMigrations.Step.of(
            """
            CREATE TABLE homes (
                owner TEXT NOT NULL,
                name  TEXT NOT NULL,
                world TEXT NOT NULL,
                x     REAL NOT NULL,
                y     REAL NOT NULL,
                z     REAL NOT NULL,
                yaw   REAL NOT NULL,
                pitch REAL NOT NULL,
                PRIMARY KEY (owner, name)
            )
            """
        )
        // v2 以後：在這裡往後加，例如
        // , SchemaMigrations.Step.of("ALTER TABLE homes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0")
    );
}
```

### `Home.java`

```java
package com.example.homes.domain;

import java.util.UUID;

/** 玩家的一個家。領域型別只用 JDK 型別，所以不需要 Bukkit 就能建立與測試。 */
public record Home(UUID owner, String name, String world, double x, double y, double z, float yaw, float pitch) {

    public Home {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Home name must not be blank");
        }
    }
}
```

### `HomeRepository.java`

```java
package com.example.homes.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 家的持久層介面。實作必須是執行緒安全的（讀在非同步執行緒、寫在單一寫入執行緒），
 * 呼叫端不得在主執行緒呼叫（會做磁碟 IO）。
 */
public interface HomeRepository {

    List<Home> findByOwner(UUID owner);

    Optional<Home> find(UUID owner, String name);

    /** 新增或覆寫同 owner + name 的家。 */
    void save(Home home);

    /** 刪除；不存在時回 false。 */
    boolean delete(UUID owner, String name);
}
```

### `SqliteHomeRepository.java`

```java
package com.example.homes.persistence;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;

import com.example.homes.domain.Home;
import com.example.homes.domain.HomeRepository;

/**
 * 只用 PreparedStatement（值一律以 {@code ?} 綁定）、一律 try-with-resources。
 * 單一連線被寫入執行緒與非同步讀取共用，所以每個方法都 {@code synchronized}。
 */
public final class SqliteHomeRepository implements HomeRepository {

    private static final String SELECT_COLUMNS = "owner, name, world, x, y, z, yaw, pitch";

    private final SqliteDatabase database;
    private final Logger logger;

    public SqliteHomeRepository(SqliteDatabase database, Logger logger) {
        this.database = database;
        this.logger = logger;
    }

    /** 開連線並跑遷移。失敗時丟 {@link DataAccessException}，由 onEnable 決定是否停用插件。 */
    public synchronized void initialize() {
        database.open();
        try {
            SchemaMigrations.run(database.connection(), HomeSchema.STEPS, logger);
        } catch (SQLException e) {
            throw new DataAccessException("Schema migration failed", e);
        }
    }

    @Override
    public synchronized List<Home> findByOwner(UUID owner) {
        String sql = "SELECT " + SELECT_COLUMNS + " FROM homes WHERE owner = ? ORDER BY name";
        try (PreparedStatement ps = database.connection().prepareStatement(sql)) {
            ps.setString(1, owner.toString());
            try (ResultSet rs = ps.executeQuery()) {
                List<Home> result = new ArrayList<>();
                while (rs.next()) {
                    result.add(read(rs));
                }
                return List.copyOf(result);
            }
        } catch (SQLException e) {
            throw new DataAccessException("Failed to load homes of " + owner, e);
        }
    }

    @Override
    public synchronized Optional<Home> find(UUID owner, String name) {
        String sql = "SELECT " + SELECT_COLUMNS + " FROM homes WHERE owner = ? AND name = ?";
        try (PreparedStatement ps = database.connection().prepareStatement(sql)) {
            ps.setString(1, owner.toString());
            ps.setString(2, name);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(read(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DataAccessException("Failed to load home " + name + " of " + owner, e);
        }
    }

    @Override
    public synchronized void save(Home home) {
        String sql = """
            INSERT INTO homes (owner, name, world, x, y, z, yaw, pitch)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (owner, name) DO UPDATE SET
                world = excluded.world, x = excluded.x, y = excluded.y, z = excluded.z,
                yaw = excluded.yaw, pitch = excluded.pitch
            """;
        try (PreparedStatement ps = database.connection().prepareStatement(sql)) {
            ps.setString(1, home.owner().toString());
            ps.setString(2, home.name());
            ps.setString(3, home.world());
            ps.setDouble(4, home.x());
            ps.setDouble(5, home.y());
            ps.setDouble(6, home.z());
            ps.setFloat(7, home.yaw());
            ps.setFloat(8, home.pitch());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new DataAccessException("Failed to save home " + home.name() + " of " + home.owner(), e);
        }
    }

    @Override
    public synchronized boolean delete(UUID owner, String name) {
        try (PreparedStatement ps = database.connection()
                 .prepareStatement("DELETE FROM homes WHERE owner = ? AND name = ?")) {
            ps.setString(1, owner.toString());
            ps.setString(2, name);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new DataAccessException("Failed to delete home " + name + " of " + owner, e);
        }
    }

    /** 多筆寫入包成一個交易：比逐筆自動提交快很多，也不會留下寫一半的狀態。 */
    public synchronized void saveAll(List<Home> homes) {
        try {
            var connection = database.connection();
            connection.setAutoCommit(false);
            try {
                for (Home home : homes) {
                    save(home);
                }
                connection.commit();
            } catch (RuntimeException | SQLException e) {
                connection.rollback();
                throw e;
            } finally {
                connection.setAutoCommit(true);
            }
        } catch (SQLException e) {
            throw new DataAccessException("Failed to save " + homes.size() + " homes", e);
        }
    }

    private static Home read(ResultSet rs) throws SQLException {
        return new Home(
            UUID.fromString(rs.getString("owner")),
            rs.getString("name"),
            rs.getString("world"),
            rs.getDouble("x"), rs.getDouble("y"), rs.getDouble("z"),
            rs.getFloat("yaw"), rs.getFloat("pitch"));
    }
}
```

### `HomeFlusher.java`

```java
package com.example.homes.persistence;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;

import com.example.homes.domain.Home;
import com.example.homes.domain.HomeRepository;

/**
 * write-behind：任何執行緒呼叫 {@link #markSaved}／{@link #markDeleted} 只改 dirty map；
 * 單一寫入執行緒負責把 dirty map 排空到資料庫。
 *
 * <p>dirty map 的值是「最新意圖」：{@code Optional.of(home)} = 要寫入，{@code Optional.empty()} = 要刪除。
 * 排空時用 {@code remove(key, value)}，若寫入期間又有更新，新值會留在 map 裡等下一輪。
 */
public final class HomeFlusher {

    private record Key(UUID owner, String name) {
    }

    private final HomeRepository repository;
    private final Logger logger;
    private final Map<Key, Optional<Home>> dirty = new ConcurrentHashMap<>();
    private final ExecutorService writer = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "Homes-writer");
        thread.setDaemon(true);
        return thread;
    });

    public HomeFlusher(HomeRepository repository, Logger logger) {
        this.repository = repository;
        this.logger = logger;
    }

    public void markSaved(Home home) {
        dirty.put(new Key(home.owner(), home.name()), Optional.of(home));
    }

    public void markDeleted(UUID owner, String name) {
        dirty.put(new Key(owner, name), Optional.empty());
    }

    /** 排程器週期呼叫（可在任何執行緒）：把排空工作交給單一寫入執行緒。 */
    public void requestFlush() {
        try {
            writer.execute(this::drain);
        } catch (RejectedExecutionException e) {
            logger.debug("Flush requested after shutdown; the final synchronous flush will cover it.");
        }
    }

    /** 排空 dirty map。只由寫入執行緒或 {@link #close} 呼叫。 */
    private void drain() {
        for (Map.Entry<Key, Optional<Home>> entry : Map.copyOf(dirty).entrySet()) {
            try {
                Optional<Home> intent = entry.getValue();
                if (intent.isPresent()) {
                    repository.save(intent.get());
                } else {
                    repository.delete(entry.getKey().owner(), entry.getKey().name());
                }
                dirty.remove(entry.getKey(), intent);
            } catch (RuntimeException e) {
                // 留在 dirty map 裡，下一輪重試；不要吞掉
                logger.error("Failed to persist home {} of {}; will retry", entry.getKey().name(),
                    entry.getKey().owner(), e);
            }
        }
    }

    /**
     * 給 onDisable：排程器已關閉，不能再排任務，所以先停掉寫入執行緒、等它做完，
     * 再在呼叫端執行緒同步排空剩下的內容。呼叫之後才可以關資料庫。
     */
    public void close(long timeoutSeconds) {
        writer.shutdown();
        try {
            if (!writer.awaitTermination(timeoutSeconds, TimeUnit.SECONDS)) {
                logger.error("Writer did not finish within {}s; forcing shutdown.", timeoutSeconds);
                writer.shutdownNow();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            writer.shutdownNow();
        }
        drain();
        if (!dirty.isEmpty()) {
            logger.error("{} home change(s) could not be persisted.", dirty.size());
        }
    }
}
```

### `HomeService.java`

```java
package com.example.homes;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

import org.bukkit.plugin.java.JavaPlugin;

import com.example.homes.domain.Home;
import com.example.homes.domain.HomeRepository;
import com.example.homes.persistence.HomeFlusher;

/**
 * 讀：非同步查詢，結果再排回主執行緒交給 callback。
 * 寫：交給 {@link HomeFlusher}（write-behind），呼叫端不會被磁碟 IO 卡住。
 */
public final class HomeService {

    private final JavaPlugin plugin;
    private final HomeRepository repository;
    private final HomeFlusher flusher;

    public HomeService(JavaPlugin plugin, HomeRepository repository, HomeFlusher flusher) {
        this.plugin = plugin;
        this.repository = repository;
        this.flusher = flusher;
    }

    /** callback 一定在主執行緒執行；查詢失敗時以空 list 呼叫並記錄錯誤。 */
    public void loadHomes(UUID owner, Consumer<List<Home>> callback) {
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            List<Home> loaded;
            try {
                loaded = repository.findByOwner(owner);
            } catch (RuntimeException e) {
                plugin.getSLF4JLogger().error("Failed to load homes of {}", owner, e);
                loaded = List.of();
            }
            List<Home> result = loaded;
            plugin.getServer().getScheduler().runTask(plugin, () -> callback.accept(result));
        });
    }

    public void setHome(Home home) {
        flusher.markSaved(home);
    }

    public void removeHome(UUID owner, String name) {
        flusher.markDeleted(owner, name);
    }
}
```

### `HomesPlugin.java`

```java
package com.example.homes;

import java.nio.file.Path;

import org.bukkit.plugin.java.JavaPlugin;

import com.example.homes.persistence.HomeFlusher;
import com.example.homes.persistence.SqliteDatabase;
import com.example.homes.persistence.SqliteHomeRepository;

public final class HomesPlugin extends JavaPlugin {

    private static final long FLUSH_INTERVAL_TICKS = 20L * 5;
    private static final long CLOSE_TIMEOUT_SECONDS = 10L;

    private SqliteDatabase database;
    private HomeFlusher flusher;
    private HomeService homes;

    @Override
    public void onEnable() {
        Path dbFile = getDataFolder().toPath().resolve("homes.db");
        database = new SqliteDatabase(dbFile, getSLF4JLogger());
        SqliteHomeRepository repository = new SqliteHomeRepository(database, getSLF4JLogger());
        try {
            repository.initialize();
        } catch (RuntimeException e) {
            getSLF4JLogger().error("Could not initialise the database; disabling plugin.", e);
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        flusher = new HomeFlusher(repository, getSLF4JLogger());
        homes = new HomeService(this, repository, flusher);

        // 週期請求 flush：排程器只負責「叫醒」，實際寫入在單一寫入執行緒
        getServer().getScheduler().runTaskTimerAsynchronously(this, flusher::requestFlush,
            FLUSH_INTERVAL_TICKS, FLUSH_INTERVAL_TICKS);
    }

    @Override
    public void onDisable() {
        // 此時排程器已關閉：不能再 runTask／runTaskAsynchronously，必須同步落盤，之後才關資料庫
        if (flusher != null) {
            flusher.close(CLOSE_TIMEOUT_SECONDS);
        }
        if (database != null) {
            database.close();
        }
    }

    public HomeService homes() {
        return homes;
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/homes/
├── HomesPlugin.java
├── HomeService.java
├── domain/                      ← 無 Bukkit、可直接單元測試
│   ├── Home.java
│   └── HomeRepository.java
└── persistence/
    ├── DataAccessException.java
    ├── SqliteDatabase.java
    ├── SchemaMigrations.java
    ├── HomeSchema.java
    ├── SqliteHomeRepository.java
    └── HomeFlusher.java
src/test/java/com/example/homes/persistence/
└── SqliteHomeRepositoryTest.java   ← jdbc:sqlite::memory:，見 examples.md
```

## 執行緒安全注意事項 / Thread Safety

- **主執行緒不碰 JDBC**：讀取用 `runTaskAsynchronously`，結果以 `runTask` 排回主執行緒再碰 Bukkit 物件
- **單一寫入執行緒**：所有寫入經 `HomeFlusher` 的單執行緒 executor；Repository 方法 `synchronized` 保護共用的那一條連線
- **dirty map 存最新意圖**：同一個 key 被連續修改只會寫最後一次；排空用 `remove(key, value)`，不會蓋掉寫入期間的新值
- **`onDisable` 不能排任務**：排程器已關閉，`close()` 先停 executor、等待、再同步排空，最後才 `database.close()`
- Repository 與 Flusher 不持有 Bukkit 物件（`Player`、`Location`、`World`），只傳 UUID／世界名稱等純資料
- 詳見 [`references/paper-threading.md`](references/paper-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `No suitable driver` / `ClassNotFoundException: org.sqlite.JDBC` | 未宣告 `libraries:`，或使用 `paper-plugin.yml` | `plugin.yml` 加 `libraries:`；`paper-plugin.yml` 改用 `PluginLoader` |
| `UnsatisfiedLinkError`／找不到原生庫 | 把 sqlite-jdbc shade／relocate 進 jar | 不打包，`compileOnly` + `libraries:` |
| `SQLITE_BUSY: database is locked` | 多個連線同時寫，或 busy_timeout 太短 | 只用一條連線與單一寫入執行緒；保留 `busy_timeout` |
| 外鍵約束沒有生效 | `foreign_keys` 預設關閉，且每條連線各自設定 | `open()` 每次都執行 `PRAGMA foreign_keys=ON` |
| 遷移到一半失敗，資料庫狀態不明 | 步驟沒包交易 | 每步一個交易，`user_version` 在同一交易內更新 |
| 升級後舊玩家資料格式錯誤 | 修改了已發布的遷移步驟 | 永遠新增步驟，不改舊步驟 |
| 關服後最後幾秒的資料遺失 | `onDisable` 才排任務，排程器已關閉 | `close()` 同步排空，再關資料庫 |
| 關閉後出現 `Database is closed` | 延遲的非同步任務在 `close()` 後才執行 | 每次經 `database.connection()` 取連線；任務內捕捉 `DataAccessException` 並記錄 |
| 單元測試需要伺服器 | Repository 依賴 Bukkit 型別 | 領域型別只用 JDK 型別，用 `jdbc:sqlite::memory:` 測試 |
