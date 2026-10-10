---
name: nms-boss-event
description: "透過 NMS ServerBossEvent 操作 Boss Bar 進度條、顏色、風格、可見性，實現每人獨立 Boss Bar（Paper NMS + Mojang-mapped）/ Operate Boss Bar progress, color, style, and per-player visibility via NMS ServerBossEvent"
---

# NMS Boss Event

## Skill Name

`nms-boss-event`

## Purpose

Use NMS `ServerBossEvent` to precisely control a Boss Bar's progress, color, style (segment notches) and visibility, and to give each player their own Boss Bar content (with the Bukkit BossBar API, each bar looks the same to all players).

## NMS Version Requirements

- Paper 1.21.11 / 26.2(both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- "boss bar", "BossEvent", "boss 進度條", "NMS boss bar", "伺服器 boss bar"
- "ServerBossEvent", "per-player boss bar", "每人 boss bar", "boss overlay"
- "boss 顏色", "boss 風格", "boss 分段"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.display` | Package of the generated classes |
| `class_name` | `BossBarManager` | Manager class name |
| `per_player` | `true` | Whether each player gets an independent Boss Bar |

## Outputs

- `BossBarManager.java` — Boss Bar creation and management
- `NmsBossBar.java` — Wrapper around a single ServerBossEvent

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `NmsBossBar.java` (single Boss Bar wrapper)

```java
package com.example.display;

import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.BossEvent;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

import java.util.UUID;

@SuppressWarnings("UnstableApiUsage")
public class NmsBossBar {

    private final ServerBossEvent bossEvent;

    /**
     * Creates an NMS ServerBossEvent.
     *
     * @param title  display title
     * @param color  BossEvent.BossBarColor (PINK, BLUE, RED, GREEN, YELLOW, PURPLE, WHITE)
     * @param overlay BossEvent.BossBarOverlay (PROGRESS, NOTCHED_6, NOTCHED_10, NOTCHED_12, NOTCHED_20)
     */
    public NmsBossBar(String title, BossEvent.BossBarColor color,
                      BossEvent.BossBarOverlay overlay) {
        // Since 26.x the constructor requires an explicit boss bar UUID (1.21.11 has no such parameter; see the trailing marker)
        this.bossEvent = new ServerBossEvent(UUID.randomUUID(), Component.literal(title), color, overlay); // @1.21.11: this.bossEvent = new ServerBossEvent(Component.literal(title), color, overlay);
    }

    /** Sets the progress (0.0 - 1.0). */
    public void setProgress(float progress) {
        bossEvent.setProgress(Math.max(0f, Math.min(1f, progress)));
    }

    /** Sets the display title. */
    public void setTitle(String title) {
        bossEvent.setName(Component.literal(title));
    }

    /** Sets the color. */
    public void setColor(BossEvent.BossBarColor color) {
        bossEvent.setColor(color);
    }

    /** Sets the style (segment notches). */
    public void setOverlay(BossEvent.BossBarOverlay overlay) {
        bossEvent.setOverlay(overlay);
    }

    /** Sets visibility (for all added players). */
    public void setVisible(boolean visible) {
        bossEvent.setVisible(visible);
    }

    /** Sets whether the screen is darkened (fog effect). */
    public void setDarkenScreen(boolean darken) {
        bossEvent.setDarkenScreen(darken);
    }

    /** Sets whether boss music is played. */
    public void setPlayBossMusic(boolean play) {
        bossEvent.setPlayBossMusic(play);
    }

    /** Adds a player (shows the Boss Bar to this player). */
    public void addPlayer(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        bossEvent.addPlayer(nms);
    }

    /** Removes a player (hides the Boss Bar). */
    public void removePlayer(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        bossEvent.removePlayer(nms);
    }

    /** Removes all players. */
    public void removeAllPlayers() {
        bossEvent.removeAllPlayers();
    }

    /** Returns the underlying ServerBossEvent (for advanced operations). */
    public ServerBossEvent getHandle() {
        return bossEvent;
    }
}
```

### `BossBarManager.java` (per-player Boss Bar manager)

```java
package com.example.display;

import net.minecraft.world.BossEvent;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.Plugin;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@SuppressWarnings("UnstableApiUsage")
public class BossBarManager implements Listener {

    private final Map<UUID, NmsBossBar> playerBars = new HashMap<>();

    public BossBarManager(Plugin plugin) {
        plugin.getServer().getPluginManager().registerEvents(this, plugin);
    }

    /** Gets or creates the player's Boss Bar. */
    public NmsBossBar getOrCreate(Player player, String title,
                                  BossEvent.BossBarColor color,
                                  BossEvent.BossBarOverlay overlay) {
        return playerBars.computeIfAbsent(player.getUniqueId(), k -> {
            NmsBossBar bar = new NmsBossBar(title, color, overlay);
            bar.addPlayer(player);
            return bar;
        });
    }

    /** Updates the player's Boss Bar title and progress. */
    public void update(Player player, String title, float progress) {
        NmsBossBar bar = playerBars.get(player.getUniqueId());
        if (bar == null) return;
        bar.setTitle(title);
        bar.setProgress(progress);
    }

    /** Removes the player's Boss Bar. */
    public void remove(Player player) {
        NmsBossBar bar = playerBars.remove(player.getUniqueId());
        if (bar != null) bar.removePlayer(player);
    }

    /** Removes all Boss Bars. */
    public void removeAll() {
        playerBars.values().forEach(NmsBossBar::removeAllPlayers);
        playerBars.clear();
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        remove(event.getPlayer());
    }
}
```

### Usage Example

```java
// Initialize the manager
BossBarManager manager = new BossBarManager(plugin);

// Create the player's Boss Bar (independent per player)
NmsBossBar bar = manager.getOrCreate(
    player,
    "§6§lQuest Progress",
    BossEvent.BossBarColor.YELLOW,
    BossEvent.BossBarOverlay.PROGRESS
);

// Update progress (call on the main thread)
Bukkit.getScheduler().runTaskTimer(plugin, () -> {
    for (Player p : Bukkit.getOnlinePlayers()) {
        float progress = getPlayerProgress(p); // 0.0 - 1.0
        manager.update(p, "§6§lQuest Progress: " + (int)(progress * 100) + "%", progress);
    }
}, 0L, 20L);
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── display/
    ├── NmsBossBar.java
    └── BossBarManager.java
```

## Thread Safety

- ⚠️ `addPlayer()`, `removePlayer()`, `setProgress()` and other `ServerBossEvent` operations **must be called on the main thread**
- ✅ `BossBarManager`'s event callback (PlayerQuitEvent) already fires on the main thread, so it is safe
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| Boss Bar not shown | `addPlayer()` was not called | Make sure `getOrCreate()` or `addPlayer()` runs |
| Bar disappears after a player rejoins | PlayerJoinEvent is not handled | Call `addPlayer()` again in PlayerJoinEvent |
| Crash from out-of-range progress | progress > 1.0 or < 0.0 | `setProgress` already clamps; verify the value you pass |
| Memory leak (bar still held after the player leaves) | PlayerQuitEvent is not listened to | Use `BossBarManager` (has a built-in `@EventHandler`) |
