# Paper SQLite Repository

## Purpose

Give a Paper plugin a small, reliable SQLite persistence skeleton: a single connection with WAL, ordered migrations based on `PRAGMA user_version`, a Bukkit-free Repository, and write-behind on a single writer thread. The domain layer uses only JDK types, so it can be unit-tested with `jdbc:sqlite::memory:` without MockBukkit.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both compile-verified)
- Pure Paper API, no Paperweight needed
- `org.xerial:sqlite-jdbc` contains JNI and **must not be shaded**: use `compileOnly` + `libraries:` in `plugin.yml`

---

## Generated Code

### SqliteDatabase.java (pragmas)

```java
Connection opened = DriverManager.getConnection(jdbcUrl);
try (Statement stmt = opened.createStatement()) {
    stmt.execute("PRAGMA journal_mode=WAL");
    stmt.execute("PRAGMA busy_timeout=3000");
    stmt.execute("PRAGMA foreign_keys=ON");
}
```

### HomeSchema.java (migrations only append)

```java
public static final List<SchemaMigrations.Step> STEPS = List.of(
    SchemaMigrations.Step.of("CREATE TABLE homes (...)"),           // v1, released, must not change
    SchemaMigrations.Step.of("ALTER TABLE homes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0") // v2
);
```

### SqliteHomeRepository.java (PreparedStatement)

```java
try (PreparedStatement ps = database.connection().prepareStatement(
        "SELECT owner, name, world, x, y, z, yaw, pitch FROM homes WHERE owner = ?")) {
    ps.setString(1, owner.toString());
    try (ResultSet rs = ps.executeQuery()) { ... }
}
```

### HomesPlugin.java (lifecycle)

```java
getServer().getScheduler().runTaskTimerAsynchronously(this, flusher::requestFlush, 100L, 100L);

@Override
public void onDisable() {
    flusher.close(10L);   // scheduler is already shut down: drain synchronously
    database.close();     // close the database last
}
```

---

## Rules

- Migration steps may only be appended; released steps must not be reordered or modified; one transaction per step
- SQL is always `PreparedStatement` + try-with-resources, with values bound via `?`
- Domain types and the Repository interface contain no Bukkit types
- Do not shade / relocate sqlite-jdbc; `libraries:` is supported only in `plugin.yml`

---

## Thread Safety

- The main thread never touches JDBC: reads go through `runTaskAsynchronously`, and results are scheduled back to the main thread with `runTask`
- All writes go through the single writer thread; the shared single connection is protected by the Repository's `synchronized`
- The dirty map stores the latest intent, and draining uses `remove(key, value)` so newer values are not overwritten
- `onDisable` must not schedule further tasks: stop the executor, wait, drain synchronously, and close the database last
