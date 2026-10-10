---
name: paper-sqlite-repository
description: "Paper 插件的 SQLite 持久化：單一連線（WAL、busy_timeout、foreign_keys）、PRAGMA user_version 遷移、Repository 介面與 PreparedStatement 實作、單一寫入執行緒的 write-behind、onDisable 同步落盤 / SQLite persistence for Paper plugins with versioned migrations, a Bukkit-free repository, and a single-writer write-behind flusher"
---

# Paper SQLite Repository

## Skill Name

`paper-sqlite-repository`

## Purpose

A small, reliable SQLite persistence skeleton for Paper plugins:

- **One connection, one writer thread**: SQLite allows only one writer at a time, so instead of a connection pool, use a single connection with WAL and `busy_timeout`.
- **Versioned migrations**: `PRAGMA user_version` records the number of applied steps; steps may only be appended, and published steps must never be reordered or modified.
- **Bukkit-free Repository interface**: domain types use only JDK types and the implementation uses only `PreparedStatement`, so it can be unit-tested directly with `jdbc:sqlite::memory:` without MockBukkit.
- **write-behind**: the main thread only changes memory and marks entries dirty; a single thread writes them in batches. The scheduler is already shut down during `onDisable`, so the final flush must be synchronous.

The example domain of this skill is the player home.

## Paper Version Requirements

- Paper 1.21.11 / 26.2(uses only the Bukkit scheduler and JDBC; identical on both versions)
- Pure Paper API; Paperweight is not needed
- The `org.xerial:sqlite-jdbc` driver contains a JNI native library: **do not shade/relocate it**; let the server download it through `libraries:` in `plugin.yml`

## Triggers

- "SQLite", "資料庫", "持久化", "persistence", "repository"
- "schema 遷移", "migration", "user_version", "資料表升級"
- "write-behind", "非同步存檔", "寫入執行緒", "onDisable 存檔"
- "sqlite-jdbc", "WAL", "SQLITE_BUSY", "database is locked"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `base_package` | `com.example.homes` | Plugin root package |
| `domain_type` | `Home` | Domain type (record, JDK types only) |
| `table` | `homes` | Table name |
| `db_file` | `homes.db` | File name under `getDataFolder()` |
| `write_mode` | `write-behind` / `write-through` | Write strategy; use write-behind for high-frequency updates |

## Outputs

- `DataAccessException.java` — unchecked exception for data access
- `SqliteDatabase.java` — open/close of the single connection, and pragmas
- `SchemaMigrations.java` — step-by-step migration driven by `user_version`, one transaction per step
- `HomeSchema.java` — this plugin's ordered migration steps
- `Home.java` / `HomeRepository.java` — domain type and interface (no Bukkit)
- `SqliteHomeRepository.java` — `PreparedStatement` implementation
- `HomeFlusher.java` — dirty map + single writer thread
- `HomeService.java` — async reads, results returned to the main thread
- `HomesPlugin.java` — lifecycle wiring and synchronous flush in `onDisable`

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). The driver is `compileOnly` only and is not bundled:

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

`plugin.yml` (`libraries:` is supported only in `plugin.yml`; with `paper-plugin.yml` use a `PluginLoader` instead):

```yaml
name: Homes
main: com.example.homes.HomesPlugin
api-version: '26.2'
libraries:
  - org.xerial:sqlite-jdbc:3.49.1.0
```

## Code Template

### `DataAccessException.java`

```java
package com.example.homes.persistence;

/** Data access failure. Unchecked, so both the catch in onEnable and error handling in async tasks can catch it. */
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
 * Connection lifecycle of one SQLite database: open, hand out the connection, close. It does not touch SQL and is not thread-safe;
 * the Repository that owns it decides how to serialize access (this template uses {@code synchronized}).
 */
public final class SqliteDatabase {

    private final String jdbcUrl;
    private final Path file;
    private final Logger logger;

    private Connection connection;

    /** File database; {@link #open()} creates the parent directory if it does not exist. */
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

    /** For tests: {@code jdbc:sqlite::memory:}; each connection is its own database (so only a single connection can be used). */
    public static SqliteDatabase inMemory(Logger logger) {
        return new SqliteDatabase(logger);
    }

    /**
     * Opens the connection and applies pragmas.
     * <ul>
     *   <li>{@code journal_mode=WAL}: reads need not wait for writes (ignored by in-memory databases)</li>
     *   <li>{@code busy_timeout=3000}: wait three seconds for the lock instead of throwing SQLITE_BUSY immediately</li>
     *   <li>{@code foreign_keys=ON}: off by default in SQLite, and a per-connection setting</li>
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
            // Load the driver explicitly; the failure message is clearer than "No suitable driver"
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

    /** The open connection. Always go through here; do not store it in a field (delayed tasks after close would get a closed connection). */
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

    /** Safe for both "never opened" and "already closed"; this is the path taken when onEnable fails halfway. */
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
 * Applies ordered migrations according to {@code PRAGMA user_version}.
 *
 * <p>Rules: the step list may only be <b>appended to</b>; published steps must not be reordered, modified or deleted.
 * After step N (0-based) succeeds, user_version becomes N+1. Each step runs in one transaction;
 * on failure it is rolled back and the database stays at the last complete version.
 */
public final class SchemaMigrations {

    private SchemaMigrations() {
    }

    /** One migration step: a list of SQL statements to run in order. */
    public record Step(List<String> sql) {

        public Step {
            sql = List.copyOf(sql);
        }

        public static Step of(String... sql) {
            return new Step(List.of(sql));
        }
    }

    /** Upgrades the database to {@code steps.size()}. Refuses to start when the database is newer than the code, to avoid data loss from a downgrade. */
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
            // PRAGMA cannot bind parameters; index is our own integer, not external input
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

/** This plugin's migration steps. Append only; to change a column, add a new step instead of editing an old one. */
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
        // v2 onward: append here, for example
        // , SchemaMigrations.Step.of("ALTER TABLE homes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0")
    );
}
```

### `Home.java`

```java
package com.example.homes.domain;

import java.util.UUID;

/** A player's home. The domain type uses only JDK types, so it can be created and tested without Bukkit. */
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
 * Persistence interface for homes. Implementations must be thread-safe (reads on async threads, writes on the single writer thread);
 * callers must not call it on the main thread (it performs disk IO).
 */
public interface HomeRepository {

    List<Home> findByOwner(UUID owner);

    Optional<Home> find(UUID owner, String name);

    /** Inserts or overwrites the home with the same owner + name. */
    void save(Home home);

    /** Deletes; returns false if it does not exist. */
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
 * Uses only PreparedStatement (values are always bound with {@code ?}) and always try-with-resources.
 * The single connection is shared by the writer thread and async reads, so every method is {@code synchronized}.
 */
public final class SqliteHomeRepository implements HomeRepository {

    private static final String SELECT_COLUMNS = "owner, name, world, x, y, z, yaw, pitch";

    private final SqliteDatabase database;
    private final Logger logger;

    public SqliteHomeRepository(SqliteDatabase database, Logger logger) {
        this.database = database;
        this.logger = logger;
    }

    /** Opens the connection and runs migrations. Throws {@link DataAccessException} on failure; onEnable decides whether to disable the plugin. */
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

    /** Wraps multiple writes in one transaction: much faster than per-row auto-commit, and never leaves a half-written state. */
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
 * write-behind: calling {@link #markSaved}/{@link #markDeleted} from any thread only changes the dirty map;
 * the single writer thread drains the dirty map into the database.
 *
 * <p>The dirty map values are the "latest intent": {@code Optional.of(home)} = write, {@code Optional.empty()} = delete.
 * Draining uses {@code remove(key, value)}, so if an update arrives during the write, the new value stays in the map for the next round.
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

    /** Called periodically by the scheduler (any thread): hands the drain work to the single writer thread. */
    public void requestFlush() {
        try {
            writer.execute(this::drain);
        } catch (RejectedExecutionException e) {
            logger.debug("Flush requested after shutdown; the final synchronous flush will cover it.");
        }
    }

    /** Drains the dirty map. Called only by the writer thread or {@link #close}. */
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
                // Stays in the dirty map and is retried next round; do not swallow it
                logger.error("Failed to persist home {} of {}; will retry", entry.getKey().name(),
                    entry.getKey().owner(), e);
            }
        }
    }

    /**
     * For onDisable: the scheduler is already shut down and cannot schedule tasks, so stop the writer thread first and wait for it to finish,
     * then synchronously drain the remainder on the calling thread. Only close the database after this call.
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
 * Reads: async query, then the result is scheduled back to the main thread for the callback.
 * Writes: handed to {@link HomeFlusher} (write-behind), so callers are never blocked by disk IO.
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

    /** The callback always runs on the main thread; if the query fails it is called with an empty list and the error is logged. */
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

        // Request a flush periodically: the scheduler only "wakes up" the writer; the actual writes happen on the single writer thread
        getServer().getScheduler().runTaskTimerAsynchronously(this, flusher::requestFlush,
            FLUSH_INTERVAL_TICKS, FLUSH_INTERVAL_TICKS);
    }

    @Override
    public void onDisable() {
        // The scheduler is already shut down: runTask/runTaskAsynchronously can no longer be used, so flush synchronously and only then close the database
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

## Recommended Directory Structure

```
src/main/java/com/example/homes/
├── HomesPlugin.java
├── HomeService.java
├── domain/                      <- no Bukkit, directly unit-testable
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
└── SqliteHomeRepositoryTest.java   <- jdbc:sqlite::memory:, see examples.md
```

## Thread Safety

- **The main thread never touches JDBC**: reads use `runTaskAsynchronously`, and results are scheduled back with `runTask` before touching Bukkit objects
- **Single writer thread**: all writes go through `HomeFlusher`'s single-thread executor; Repository methods are `synchronized` to protect the one shared connection
- **The dirty map stores the latest intent**: repeated changes to the same key write only the last one; draining uses `remove(key, value)`, so it never overwrites a newer value that arrived during the write
- **`onDisable` cannot schedule tasks**: the scheduler is already shut down; `close()` stops the executor, waits, then drains synchronously, and only then calls `database.close()`
- The Repository and Flusher hold no Bukkit objects (`Player`, `Location`, `World`); they pass only plain data such as UUIDs and world names
- See [`references/paper-threading.md`](references/paper-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| `No suitable driver` / `ClassNotFoundException: org.sqlite.JDBC` | `libraries:` not declared, or `paper-plugin.yml` is used | Add `libraries:` to `plugin.yml`; with `paper-plugin.yml` use a `PluginLoader` |
| `UnsatisfiedLinkError` / native library not found | sqlite-jdbc was shaded/relocated into the jar | Do not bundle it; use `compileOnly` + `libraries:` |
| `SQLITE_BUSY: database is locked` | Multiple connections write at once, or busy_timeout is too short | Use only one connection and a single writer thread; keep `busy_timeout` |
| Foreign key constraints are not enforced | `foreign_keys` is off by default and set per connection | `open()` runs `PRAGMA foreign_keys=ON` every time |
| Migration fails halfway and the database state is unclear | Steps are not wrapped in a transaction | One transaction per step; update `user_version` inside the same transaction |
| Old player data has the wrong format after an upgrade | A published migration step was modified | Always add new steps; never edit old ones |
| Data from the last few seconds is lost after shutdown | Tasks were scheduled in `onDisable`, when the scheduler is already shut down | `close()` drains synchronously, then close the database |
| `Database is closed` appears after shutdown | A delayed async task ran after `close()` | Always obtain the connection via `database.connection()`; catch and log `DataAccessException` inside tasks |
| Unit tests need a server | The Repository depends on Bukkit types | Use only JDK types in domain types and test with `jdbc:sqlite::memory:` |
