---
id: paper-sqlite-repository
title: Paper SQLite Repository
titleZh: SQLite 持久化 Repository
description: SQLite persistence for Paper plugins - single connection with WAL, PRAGMA user_version migrations, a Bukkit-free repository, and a single-writer write-behind flusher that drains synchronously in onDisable.
descriptionZh: Paper 插件的 SQLite 持久化：單一連線（WAL、busy_timeout、foreign_keys）、user_version 遷移、無 Bukkit 的 Repository，以及 onDisable 同步落盤的單一寫入執行緒 write-behind。
version: "1.0.0"
status: active
category: paper-data
categoryLabel: Paper 資料
categoryLabelEn: Paper Data
tags: [paper-api, sqlite, repository, migration, write-behind, persistence]
triggerKeywords:
  - "SQLite"
  - "資料庫"
  - "持久化"
  - "schema 遷移"
  - "user_version"
  - "write-behind"
  - "sqlite-jdbc"
  - "SQLITE_BUSY"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-sqlite-repository/SKILL.md
featured: false
---

# Paper SQLite Repository

## 目的

給 Paper 插件一套小而可靠的 SQLite 持久化骨架：一條連線加 WAL、依 `PRAGMA user_version` 的有序遷移、不含 Bukkit 的 Repository，以及單一寫入執行緒的 write-behind。領域層只用 JDK 型別，所以可用 `jdbc:sqlite::memory:` 單元測試，不需要 MockBukkit。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證）
- 純 Paper API，不需要 Paperweight
- `org.xerial:sqlite-jdbc` 含 JNI，**不可 shade**：`compileOnly` + `plugin.yml` 的 `libraries:`

---

## 產生的代碼

### SqliteDatabase.java（pragma）

```java
Connection opened = DriverManager.getConnection(jdbcUrl);
try (Statement stmt = opened.createStatement()) {
    stmt.execute("PRAGMA journal_mode=WAL");
    stmt.execute("PRAGMA busy_timeout=3000");
    stmt.execute("PRAGMA foreign_keys=ON");
}
```

### HomeSchema.java（遷移只往後加）

```java
public static final List<SchemaMigrations.Step> STEPS = List.of(
    SchemaMigrations.Step.of("CREATE TABLE homes (...)"),           // v1，已發布不可改
    SchemaMigrations.Step.of("ALTER TABLE homes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0") // v2
);
```

### SqliteHomeRepository.java（PreparedStatement）

```java
try (PreparedStatement ps = database.connection().prepareStatement(
        "SELECT owner, name, world, x, y, z, yaw, pitch FROM homes WHERE owner = ?")) {
    ps.setString(1, owner.toString());
    try (ResultSet rs = ps.executeQuery()) { ... }
}
```

### HomesPlugin.java（生命週期）

```java
getServer().getScheduler().runTaskTimerAsynchronously(this, flusher::requestFlush, 100L, 100L);

@Override
public void onDisable() {
    flusher.close(10L);   // 排程器已關閉：同步排空
    database.close();     // 最後才關資料庫
}
```

---

## 規則

- 遷移步驟只能往後加，已發布的步驟不得重排或修改；每步一個交易
- SQL 一律 `PreparedStatement` + try-with-resources，值用 `?` 綁定
- 領域型別與 Repository 介面不含 Bukkit 型別
- sqlite-jdbc 不 shade／relocate；`libraries:` 只有 `plugin.yml` 支援

---

## 執行緒安全

- 主執行緒不碰 JDBC：讀取走 `runTaskAsynchronously`，結果以 `runTask` 排回主執行緒
- 所有寫入經單一寫入執行緒；共用的單一連線由 Repository 的 `synchronized` 保護
- dirty map 儲存最新意圖，排空用 `remove(key, value)` 避免蓋掉新值
- `onDisable` 不可再排任務：先停 executor、等待、同步排空，最後關資料庫
