# examples — paper-sqlite-repository

## Example 1: Test the Repository with in-memory SQLite (no MockBukkit needed)

**Input:**
```
base_package: com.example.homes
domain_type: Home
db_file: (jdbc:sqlite::memory: for tests)
```

**Output — JUnit 5 tests that depend only on sqlite-jdbc and the domain type:**
```java
package com.example.homes.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.example.homes.domain.Home;

class SqliteHomeRepositoryTest {

    private static final Logger LOG = LoggerFactory.getLogger(SqliteHomeRepositoryTest.class);

    private SqliteDatabase database;
    private SqliteHomeRepository repository;

    @BeforeEach
    void setUp() {
        database = SqliteDatabase.inMemory(LOG);
        repository = new SqliteHomeRepository(database, LOG);
        repository.initialize();
    }

    @AfterEach
    void tearDown() {
        database.close();
    }

    @Test
    void saveThenFindReturnsSameHome() {
        UUID owner = UUID.randomUUID();
        Home home = new Home(owner, "base", "world", 1.5, 64, -3.25, 90f, 10f);

        repository.save(home);

        assertEquals(Optional.of(home), repository.find(owner, "base"));
    }

    @Test
    void saveTwiceOverwritesInsteadOfDuplicating() {
        UUID owner = UUID.randomUUID();
        repository.save(new Home(owner, "base", "world", 0, 64, 0, 0f, 0f));
        repository.save(new Home(owner, "base", "world_nether", 8, 70, 8, 0f, 0f));

        List<Home> homes = repository.findByOwner(owner);

        assertEquals(1, homes.size());
        assertEquals("world_nether", homes.get(0).world());
    }

    @Test
    void deleteReportsWhetherARowWasRemoved() {
        UUID owner = UUID.randomUUID();
        repository.save(new Home(owner, "base", "world", 0, 64, 0, 0f, 0f));

        assertTrue(repository.delete(owner, "base"));
        assertFalse(repository.delete(owner, "base"));
    }

    @Test
    void ownersAreIsolated() {
        UUID alice = UUID.randomUUID();
        UUID bob = UUID.randomUUID();
        repository.save(new Home(alice, "base", "world", 0, 64, 0, 0f, 0f));

        assertTrue(repository.findByOwner(bob).isEmpty());
    }

    @Test
    void userVersionEqualsNumberOfSteps() throws Exception {
        assertEquals(HomeSchema.STEPS.size(), SchemaMigrations.currentVersion(database.connection()));
    }

    @Test
    void flusherPersistsLatestIntentOnClose() {
        UUID owner = UUID.randomUUID();
        HomeFlusher flusher = new HomeFlusher(repository, LOG);
        flusher.markSaved(new Home(owner, "base", "world", 0, 64, 0, 0f, 0f));
        flusher.markSaved(new Home(owner, "base", "world", 5, 64, 5, 0f, 0f));
        flusher.markSaved(new Home(owner, "mine", "world", 9, 12, 9, 0f, 0f));
        flusher.markDeleted(owner, "mine");

        flusher.close(5);   // Drain synchronously, same as onDisable

        assertEquals(5.0, repository.find(owner, "base").orElseThrow().x());
        assertTrue(repository.find(owner, "mine").isEmpty());
    }
}
```

Key points: each `SqliteDatabase.inMemory` instance is an independent database, so tests do not contaminate each other; the whole test starts no server and mocks no Bukkit types.

---

## Example 2: Add a column via migration (with an "upgrade from an old version" test)

**Input:**
```
change: add created_at (creation time, milliseconds) to the homes table
shipped_versions: user_version = 1 is already on player servers
```

**Output — append a single step to `STEPS`; leave v1 completely untouched:**
```java
package com.example.homes.persistence;

import java.util.List;

public final class HomeSchema {

    private HomeSchema() {
    }

    public static final List<SchemaMigrations.Step> STEPS = List.of(
        // v1 (published, must not be modified)
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
        ),
        // v2: old data has no creation time; the default 0 means "unknown"
        SchemaMigrations.Step.of(
            "ALTER TABLE homes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0"
        )
    );
}
```

**Test the upgrade path: stop at v1, insert an old row, then run the full migration:**
```java
package com.example.homes.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

class HomeSchemaUpgradeTest {

    private static final Logger LOG = LoggerFactory.getLogger(HomeSchemaUpgradeTest.class);

    @Test
    void v1DataSurvivesUpgradeToLatest() throws Exception {
        SqliteDatabase database = SqliteDatabase.inMemory(LOG);
        database.open();
        try {
            // Apply only the first step = simulate an old server
            SchemaMigrations.run(database.connection(), HomeSchema.STEPS.subList(0, 1), LOG);
            assertEquals(1, SchemaMigrations.currentVersion(database.connection()));

            UUID owner = UUID.randomUUID();
            try (PreparedStatement ps = database.connection().prepareStatement(
                    "INSERT INTO homes (owner, name, world, x, y, z, yaw, pitch) VALUES (?, 'old', 'world', 1, 2, 3, 0, 0)")) {
                ps.setString(1, owner.toString());
                ps.executeUpdate();
            }

            // Now apply the full list = upgrade
            SchemaMigrations.run(database.connection(), HomeSchema.STEPS, LOG);

            assertEquals(HomeSchema.STEPS.size(), SchemaMigrations.currentVersion(database.connection()));
            try (Statement st = database.connection().createStatement();
                 ResultSet rs = st.executeQuery("SELECT created_at FROM homes WHERE name = 'old'")) {
                rs.next();
                assertEquals(0L, rs.getLong(1));
            }
        } finally {
            database.close();
        }
    }

    @Test
    void runningTwiceIsANoOp() throws Exception {
        SqliteDatabase database = SqliteDatabase.inMemory(LOG);
        database.open();
        try {
            SchemaMigrations.run(database.connection(), HomeSchema.STEPS, LOG);
            SchemaMigrations.run(database.connection(), HomeSchema.STEPS, LOG);
            assertEquals(HomeSchema.STEPS.size(), SchemaMigrations.currentVersion(database.connection()));
        } finally {
            database.close();
        }
    }

    @Test
    void newerDatabaseThanPluginIsRejected() throws Exception {
        SqliteDatabase database = SqliteDatabase.inMemory(LOG);
        database.open();
        try {
            SchemaMigrations.run(database.connection(), HomeSchema.STEPS, LOG);
            List<SchemaMigrations.Step> older = HomeSchema.STEPS.subList(0, 1);
            org.junit.jupiter.api.Assertions.assertThrows(java.sql.SQLException.class,
                () -> SchemaMigrations.run(database.connection(), older, LOG));
        } finally {
            database.close();
        }
    }
}
```

Afterwards, include `created_at` in the SQL of `SqliteHomeRepository`'s `save`/`read`; **never go back and modify a migration step just to fit new code**.

---

## Example 3: Load homes on join, and flush on shutdown

**Input:**
```
scenario: load homes asynchronously when a player joins and return the result to the main thread; /sethome only updates the dirty map
```

**Output — the Listener and command go only through `HomeService` and never touch JDBC:**
```java
package com.example.homes;

import java.util.List;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

import net.kyori.adventure.text.Component;

import com.example.homes.domain.Home;

public final class HomeJoinListener implements Listener {

    private final HomeService homes;

    public HomeJoinListener(HomeService homes) {
        this.homes = homes;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        homes.loadHomes(player.getUniqueId(), loaded -> {
            // The callback runs on the main thread; the player may have gone offline during the query, so check first
            if (!player.isOnline()) {
                return;
            }
            player.sendMessage(Component.text("You have " + loaded.size() + " home(s)."));
        });
    }

    /** /sethome: read the location on the main thread, convert it to plain data, then hand it to write-behind. */
    public void setHome(Player player, String name) {
        var location = player.getLocation();
        homes.setHome(new Home(player.getUniqueId(), name, location.getWorld().getName(),
            location.getX(), location.getY(), location.getZ(), location.getYaw(), location.getPitch()));
        player.sendMessage(Component.text("Home '" + name + "' saved."));
    }

    static int count(List<Home> homes) {
        return homes.size();
    }
}
```

Key points:
- `Location` is converted to `Home` (plain data) on the main thread before entering the persistence layer
- The `loadHomes` callback runs on the main thread and the player may already be offline, so check `isOnline()` before using it
- On server shutdown, `HomesPlugin.onDisable` -> `HomeFlusher.close` synchronously writes any changes not yet persisted
