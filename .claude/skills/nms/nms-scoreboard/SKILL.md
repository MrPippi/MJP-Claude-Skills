---
name: nms-scoreboard
description: "透過 NMS Scoreboard/Objective/Team API 操作 sidebar、tablist 顯示名稱與計分板（Paper NMS + Mojang-mapped）/ Operate sidebar, tablist, and scoreboard via NMS Scoreboard/Objective/Team API"
---

# NMS Scoreboard / NMS 計分板操作

## 技能名稱 / Skill Name

`nms-scoreboard`

## 目的 / Purpose

透過 NMS `Scoreboard`、`Objective`、`Team` 直接操作 sidebar 計分板、tablist 顯示名稱、玩家 prefix/suffix，繞過 Bukkit Scoreboard API 的封包延遲與限制。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）

## 觸發條件 / Triggers

- 「scoreboard」「sidebar」「tablist」「Objective NMS」「Team NMS」
- 「計分板」「nms scoreboard」「player list name」「prefix suffix」
- 「顯示板」「nms sidebar」「分數顯示」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.display` | 產出類別所在 package |
| `manager_class_name` | `ScoreboardManager` | 管理器類名稱 |
| `display_slot` | `sidebar` / `list` / `below_name` | 顯示位置 |
| `per_player` | `true` | 是否每人一個獨立計分板 |

## 輸出產物 / Outputs

- `ScoreboardManager.java` — 計分板建立與更新工具
- `SidebarDisplay.java` — Sidebar 行內容管理
- `TeamManager.java` — Team prefix/suffix/tablist 管理

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## 代碼範本 / Code Template

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
 * Per-player sidebar：每位玩家一個不掛在伺服器上的 NMS Scoreboard，只透過封包同步給該玩家。
 * 1.20.3+ 分數的持有者為 {@link ScoreHolder}（不再是 String）。
 */
@SuppressWarnings("UnstableApiUsage")
public class ScoreboardManager {

    private static final String OBJECTIVE_NAME = "mps_sidebar";
    private final Map<UUID, Scoreboard> playerBoards = new HashMap<>();

    /** 取得或建立玩家專屬的 NMS Scoreboard（per-player 模式）。 */
    public Scoreboard getOrCreate(Player player) {
        return playerBoards.computeIfAbsent(player.getUniqueId(), k -> {
            Scoreboard board = new Scoreboard();
            Objective obj = board.addObjective(
                OBJECTIVE_NAME,
                ObjectiveCriteria.DUMMY,
                Component.literal("§6§l我的伺服器"),
                ObjectiveCriteria.RenderType.INTEGER,
                true,
                null
            );
            board.setDisplayObjective(DisplaySlot.SIDEBAR, obj);
            return board;
        });
    }

    /** 設定 sidebar 某行的分數（行 = 分數，數字大的在上方），並同步給玩家。 */
    public void setLine(Player player, String entry, int score) {
        Scoreboard board = getOrCreate(player);
        Objective obj = board.getObjective(OBJECTIVE_NAME);
        if (obj == null) return;
        board.getOrCreatePlayerScore(ScoreHolder.forNameOnly(entry), obj).set(score);
        handle(player).connection.send(new ClientboundSetScorePacket(
            entry, OBJECTIVE_NAME, score, Optional.empty(), Optional.empty()));
    }

    /** 移除某行，並同步給玩家。 */
    public void removeLine(Player player, String entry) {
        Scoreboard board = getOrCreate(player);
        Objective obj = board.getObjective(OBJECTIVE_NAME);
        if (obj == null) return;
        board.resetSinglePlayerScore(ScoreHolder.forNameOnly(entry), obj);
        handle(player).connection.send(new ClientboundResetScorePacket(entry, OBJECTIVE_NAME));
    }

    /** 將整個 Scoreboard 推送給玩家（objective → display slot → 所有分數）。 */
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

    /** 清除玩家計分板資料，並通知客戶端移除 objective。 */
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

### `SidebarDisplay.java`（行內容封裝）

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

    /** 新增一行（score 大的在上方）。 */
    public SidebarDisplay addLine(String text, int score) {
        lines.put(text, score);
        return this;
    }

    /**
     * 建立僅存在於封包層的 sidebar 並推送給玩家。
     * 獨立的 Scoreboard 不是 ServerScoreboard，沒有 getStartTrackingPackets()，因此手動組封包。
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

### `TeamManager.java`（prefix/suffix/tablist）

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

    /** 建立或取得 Team，設定 prefix 與 suffix。 */
    public PlayerTeam setTeam(String teamName, String prefix, String suffix) {
        PlayerTeam team = scoreboard.getPlayerTeam(teamName);
        if (team == null) {
            team = scoreboard.addPlayerTeam(teamName);
        }
        team.setPlayerPrefix(Component.literal(prefix));
        team.setPlayerSuffix(Component.literal(suffix));
        return team;
    }

    /** 將玩家加入 Team。 */
    public void addPlayer(Player player, String teamName) {
        PlayerTeam team = scoreboard.getPlayerTeam(teamName);
        if (team == null) team = scoreboard.addPlayerTeam(teamName);
        scoreboard.addPlayerToTeam(player.getName(), team);
    }

    /** 移除玩家的 Team 歸屬。 */
    public void removePlayer(Player player) {
        scoreboard.removePlayerFromTeam(player.getName(),
            scoreboard.getPlayersTeam(player.getName()));
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── display/
    ├── ScoreboardManager.java
    ├── SidebarDisplay.java
    └── TeamManager.java
```

## 執行緒安全注意事項 / Thread Safety

- ⚠️ 所有 Scoreboard/Objective/Team 操作**必須在主執行緒呼叫**
- ✅ `connection.send()` 可在任意執行緒呼叫，但封包建構需在主執行緒完成
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| Sidebar 不顯示 | Objective 未設到 SIDEBAR slot | 確認 `setDisplayObjective(DisplaySlot.SIDEBAR, ...)` |
| Team prefix 無效 | prefix 超過 64 字元限制 | 截短字串 |
| 玩家離線後 NPE | playerBoards 持有 UUID | 在 PlayerQuitEvent 呼叫 `remove()` |
| 分數行重複 | entry 字串相同 | 每行使用不同的 `"§a"` 等顏色前綴區分 |
