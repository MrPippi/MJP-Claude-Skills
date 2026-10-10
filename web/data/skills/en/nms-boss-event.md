# NMS Boss Event

## Purpose

Precisely control the progress, color, style (notched segments), and visibility of a boss bar through NMS `ServerBossEvent`, and give each player independent boss bar content (with the Bukkit BossBar API, each bar is the same for all players).

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### NmsBossBar.java (single boss bar wrapper)

```java
// Create a boss bar with notched segments
NmsBossBar bar = new NmsBossBar(
    "§c§lBoss §f— 100%",
    BossEvent.BossBarColor.RED,
    BossEvent.BossBarOverlay.NOTCHED_10
);

// Show to a player
bar.addPlayer(player);

// Update progress (0.0 ~ 1.0)
bar.setProgress(0.75f);

// Update title
bar.setTitle("§c§lBoss §f— 75%");
```

### BossBarManager.java (multi-player management)

```java
// Create a per-player boss bar (each player sees different progress)
BossBarManager manager = new BossBarManager(plugin);
manager.getOrCreate(player, "§aQuest Progress", BossEvent.BossBarColor.GREEN, BossEvent.BossBarOverlay.PROGRESS);
manager.update(player, "§aQuest Progress 50%", 0.5f);
manager.remove(player);
manager.removeAll();  // Call when the plugin is disabled
```

---

## Thread Safety

- `ServerBossEvent.addPlayer()` / `removePlayer()` **must be called on the main thread**
- `setProgress()` / `setName()` can be called from any thread (packets are automatically queued to the Netty write queue)
