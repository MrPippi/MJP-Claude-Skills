---
name: nms-scoreboard
description: "透過 NMS Scoreboard/Objective/Team API 操作 sidebar、tablist 顯示名稱與計分板（Paper NMS + Mojang-mapped）/ Operate sidebar, tablist, and scoreboard via NMS Scoreboard/Objective/Team API"
---

# NMS Scoreboard

## Skill Name

`nms-scoreboard`

## Purpose

Operate the sidebar scoreboard, tablist display names, and player prefix/suffix directly through NMS `Scoreboard`, `Objective`, and `Team`, bypassing the packet delay and limitations of the Bukkit Scoreboard API.

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- 「scoreboard」「sidebar」「tablist」「Objective NMS」「Team NMS」
- 「計分板」「nms scoreboard」「player list name」「prefix suffix」
- 「顯示板」「nms sidebar」「分數顯示」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.display` | Package of the generated classes |
| `manager_class_name` | `ScoreboardManager` | Name of the manager class |
| `display_slot` | `sidebar` / `list` / `below_name` | Display position |
| `per_player` | `true` | Whether each player gets an independent scoreboard |

## Outputs

- `ScoreboardManager.java` — scoreboard creation and update utility
- `SidebarDisplay.java` — sidebar line content management
- `TeamManager.java` — team prefix/suffix/tablist management

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `ScoreboardManager.java`

```java
package com.example.display;

import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundResetScorePacket;
import net.minecraft.network.protocol.game.ClientboundSetDisplayObjectivePacket;
import net.minecraft.network.protocol.game.ClientboundSetObjectivePacket;
import net.minecraft.network.protocol.game.ClientboundSetScorePacket;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.scores.DisplaySlot;
import net.minecraft.world.scores.Objective;
import net.minecraft.world.scores.PlayerScoreEntry;
import net.minecraft.world.scores.ScoreHolder;
import net.minecraft.world.scores.Scoreboard;
import net.minecraft.world.scores.criteria.ObjectiveCriteria;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Per-player sidebar: each player gets an NMS Scoreboard that is not attached to the server and is synced to that player only through packets.
 * Since 1.20.3 the holder of a score is a {@link ScoreHolder} (no longer a String).
 */
@SuppressWarnings("UnstableApiUsage")
public class ScoreboardManager {

    private static final String OBJECTIVE_NAME = "mps_sidebar";
    private final Map<UUID, Scoreboard> playerBoards = new HashMap<>();

    /** Gets or creates the player's own NMS Scoreboard (per-player mode). */
    public Scoreboard getOrCreate(Player player) {
        return playerBoards.computeIfAbsent(player.getUniqueId(), k -> {
            Scoreboard board = new Scoreboard();
            Objective obj = board.addObjective(
                OBJECTIVE_NAME,
                ObjectiveCriteria.DUMMY,
                Component.literal("§6§lMy Server"),
                ObjectiveCriteria.RenderType.INTEGER,
                true,
                null
            );
            board.setDisplayObjective(DisplaySlot.SIDEBAR, obj);
            return board;
        });
    }

    /** Sets the score of a sidebar line (line = score, larger numbers appear higher) and syncs it to the player. */
    public void setLine(Player player, String entry, int score) {
        Scoreboard board = getOrCreate(player);
        Objective obj = board.getObjective(OBJECTIVE_NAME);
        if (obj == null) return;
        board.getOrCreatePlayerScore(ScoreHolder.forNameOnly(entry), obj).set(score);
        handle(player).connection.send(new ClientboundSetScorePacket(
            entry, OBJECTIVE_NAME, score, Optional.empty(), Optional.empty()));
    }

    /** Removes a line and syncs it to the player. */
    public void removeLine(Player player, String entry) {
        Scoreboard board = getOrCreate(player);
        Objective obj = board.getObjective(OBJECTIVE_NAME);
        if (obj == null) return;
        board.resetSinglePlayerScore(ScoreHolder.forNameOnly(entry), obj);
        handle(player).connection.send(new ClientboundResetScorePacket(entry, OBJECTIVE_NAME));
    }

    /** Pushes the whole Scoreboard to the player (objective -> display slot -> all scores). */
    public void apply(Player player) {
        ServerPlayer nms = handle(player);
        Scoreboard board = getOrCreate(player);
        Objective obj = board.getObjective(OBJECTIVE_NAME);
        if (obj == null) return;
        nms.connection.send(new ClientboundSetObjectivePacket(obj, ClientboundSetObjectivePacket.METHOD_ADD));
        nms.connection.send(new ClientboundSetDisplayObjectivePacket(DisplaySlot.SIDEBAR, obj));
        for (PlayerScoreEntry e : board.listPlayerScores(obj)) {
            nms.connection.send(new ClientboundSetScorePacket(
                e.owner(), OBJECTIVE_NAME, e.value(), Optional.empty(), Optional.empty()));
        }
    }

    /** Clears the player's scoreboard data and tells the client to remove the objective. */
    public void remove(Player player) {
        Scoreboard board = playerBoards.remove(player.getUniqueId());
        if (board == null || !player.isOnline()) return;
        Objective obj = board.getObjective(OBJECTIVE_NAME);
        if (obj != null) {
            handle(player).connection.send(
                new ClientboundSetObjectivePacket(obj, ClientboundSetObjectivePacket.METHOD_REMOVE));
        }
    }

    private static ServerPlayer handle(Player player) {
        return ((CraftPlayer) player).getHandle();
    }
}
```

### `SidebarDisplay.java` (line content encapsulation)

```java
package com.example.display;

import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundSetDisplayObjectivePacket;
import net.minecraft.network.protocol.game.ClientboundSetObjectivePacket;
import net.minecraft.network.protocol.game.ClientboundSetScorePacket;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.scores.DisplaySlot;
import net.minecraft.world.scores.Objective;
import net.minecraft.world.scores.Scoreboard;
import net.minecraft.world.scores.criteria.ObjectiveCriteria;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@SuppressWarnings("UnstableApiUsage")
public class SidebarDisplay {

    private final String title;
    private final LinkedHashMap<String, Integer> lines = new LinkedHashMap<>();

    public SidebarDisplay(String title) {
        this.title = title;
    }

    /** Adds a line (larger score appears higher). */
    public SidebarDisplay addLine(String text, int score) {
        lines.put(text, score);
        return this;
    }

    /**
     * Builds a sidebar that exists only at the packet level and pushes it to the player.
     * A standalone Scoreboard is not a ServerScoreboard and has no getStartTrackingPackets(), so the packets are assembled manually.
     */
    public void show(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        Scoreboard board = new Scoreboard();

        Objective obj = board.addObjective(
            "mps_sb_" + Integer.toHexString(player.getName().hashCode()),
            ObjectiveCriteria.DUMMY,
            Component.literal(title),
            ObjectiveCriteria.RenderType.INTEGER,
            true, null
        );

        nms.connection.send(new ClientboundSetObjectivePacket(obj, ClientboundSetObjectivePacket.METHOD_ADD));
        nms.connection.send(new ClientboundSetDisplayObjectivePacket(DisplaySlot.SIDEBAR, obj));
        for (Map.Entry<String, Integer> entry : lines.entrySet()) {
            nms.connection.send(new ClientboundSetScorePacket(
                entry.getKey(), obj.getName(), entry.getValue(), Optional.empty(), Optional.empty()));
        }
    }
}
```

### `TeamManager.java` (prefix/suffix/tablist)

```java
package com.example.display;

import net.minecraft.network.chat.Component;
import net.minecraft.world.scores.PlayerTeam;
import net.minecraft.world.scores.Scoreboard;
import org.bukkit.Bukkit;
import org.bukkit.craftbukkit.CraftServer;
import org.bukkit.entity.Player;

@SuppressWarnings("UnstableApiUsage")
public class TeamManager {

    private final Scoreboard scoreboard;

    public TeamManager() {
        this.scoreboard = ((CraftServer) Bukkit.getServer()).getServer().getScoreboard();
    }

    /** Creates or gets a Team and sets its prefix and suffix. */
    public PlayerTeam setTeam(String teamName, String prefix, String suffix) {
        PlayerTeam team = scoreboard.getPlayerTeam(teamName);
        if (team == null) {
            team = scoreboard.addPlayerTeam(teamName);
        }
        team.setPlayerPrefix(Component.literal(prefix));
        team.setPlayerSuffix(Component.literal(suffix));
        return team;
    }

    /** Adds a player to a Team. */
    public void addPlayer(Player player, String teamName) {
        PlayerTeam team = scoreboard.getPlayerTeam(teamName);
        if (team == null) team = scoreboard.addPlayerTeam(teamName);
        scoreboard.addPlayerToTeam(player.getName(), team);
    }

    /** Removes the player's Team membership. */
    public void removePlayer(Player player) {
        scoreboard.removePlayerFromTeam(player.getName(),
            scoreboard.getPlayersTeam(player.getName()));
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── display/
    ├── ScoreboardManager.java
    ├── SidebarDisplay.java
    └── TeamManager.java
```

## Thread Safety

- ⚠️ All Scoreboard/Objective/Team operations **must be called on the main thread**
- ✅ `connection.send()` may be called from any thread, but packet construction must be completed on the main thread
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| Sidebar is not displayed | The Objective was not set to the SIDEBAR slot | Confirm `setDisplayObjective(DisplaySlot.SIDEBAR, ...)` |
| Team prefix has no effect | The prefix exceeds the 64-character limit | Shorten the string |
| NPE after a player goes offline | playerBoards still holds the UUID | Call `remove()` in PlayerQuitEvent |
| Duplicate score lines | The entry strings are identical | Make each line distinct with a different color prefix such as `"§a"` |
