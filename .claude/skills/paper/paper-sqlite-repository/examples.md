# examples — paper-sqlite-repository

## 範例 1：用記憶體 SQLite 測試 Repository（不需要 MockBukkit）

**Input:**
```
base_package: com.example.homes
domain_type: Home
db_file: （測試用 jdbc:sqlite::memory:）
```

**Output — JUnit 5 測試，只依賴 sqlite-jdbc 與領域型別:**
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

        flusher.close(5);   // 同步排空，等同 onDisable

        assertEquals(5.0, repository.find(owner, "base").orElseThrow().x());
        assertTrue(repository.find(owner, "mine").isEmpty());
    }
}
```

重點：`SqliteDatabase.inMemory` 每個實例是獨立資料庫，所以測試之間不會互相污染；整個測試不啟動伺服器、不 mock 任何 Bukkit 型別。

---

## 範例 2：遷移新增欄位（含「從舊版升級」的測試）

**Input:**
```
change: homes 資料表新增 created_at（建立時間，毫秒）
shipped_versions: user_version = 1 已經在玩家伺服器上
```

**Output — 只往 `STEPS` 後面加一個步驟；v1 完全不動:**
```java
package com.example.homes.persistence;

import java.util.List;

public final class HomeSchema {

    private HomeSchema() {
    }

    public static final List<SchemaMigrations.Step> STEPS = List.of(
        // v1（已發布，不可修改）
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
        // v2：舊資料沒有建立時間，預設 0 代表「未知」
        SchemaMigrations.Step.of(
            "ALTER TABLE homes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0"
        )
    );
}
```

**測試升級路徑：先停在 v1，塞一筆舊資料，再跑完整遷移:**
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
            // 只套用第一步 = 模擬舊版伺服器
            SchemaMigrations.run(database.connection(), HomeSchema.STEPS.subList(0, 1), LOG);
            assertEquals(1, SchemaMigrations.currentVersion(database.connection()));

            UUID owner = UUID.randomUUID();
            try (PreparedStatement ps = database.connection().prepareStatement(
                    "INSERT INTO homes (owner, name, world, x, y, z, yaw, pitch) VALUES (?, 'old', 'world', 1, 2, 3, 0, 0)")) {
                ps.setString(1, owner.toString());
                ps.executeUpdate();
            }

            // 現在套用完整列表 = 升級
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

之後 `SqliteHomeRepository` 的 `save`／`read` 再把 `created_at` 納入 SQL；**遷移步驟本身永遠不要為了配合新程式碼而回頭修改**。

---

## 範例 3：加入／離開時載入家，並在關閉時落盤

**Input:**
```
scenario: 玩家加入時非同步載入家，結果回主執行緒；/sethome 只更新 dirty map
```

**Output — Listener 與指令只經 `HomeService`，不碰 JDBC:**
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
            // callback 在主執行緒；玩家可能在查詢期間離線，先確認
            if (!player.isOnline()) {
                return;
            }
            player.sendMessage(Component.text("You have " + loaded.size() + " home(s)."));
        });
    }

    /** /sethome：在主執行緒讀位置，轉成純資料後交給 write-behind。 */
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

要點：
- `Location` 在主執行緒轉成 `Home`（純資料）後才進入持久層
- `loadHomes` 的 callback 在主執行緒，玩家可能已離線，使用前檢查 `isOnline()`
- 伺服器關閉時由 `HomesPlugin.onDisable` → `HomeFlusher.close` 同步補寫尚未落盤的變更
