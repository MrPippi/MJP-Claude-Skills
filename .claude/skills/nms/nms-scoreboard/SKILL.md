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

- Paper 1.21 – 1.21.3
- Paperweight userdev 1.7.2+
- Mojang mappings（已由 Paper 1.20.5+ 原生支援）

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
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}
```

## 代碼範本 / Code Template

### `ScoreboardManager.java`

```java
package com.example.display;

import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.scores.DisplaySlot;
import net.minecraft.world.scores.Objective;
import net.minecraft.world.scores.Scoreboard;
import net.minecraft.world.scores.criteria.ObjectiveCriteria;
import org.bukkit.craftbukkit.v1_21_R1.entity.CraftPlayer;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

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

    /** 設定 sidebar 某行的分數（行 = 分數，數字大的在上方）。 */
    public void setLine(Player player, String entry, int score) {
        Scoreboard board = getOrCreate(player);
        Objective obj = board.getObjective(OBJECTIVE_NAME);
        if (obj == null) return;
        board.getOrCreatePlayerScore(entry, obj).setScore(score);
    }

    /** 移除某行。 */
    public void removeLine(Player player, String entry) {
        Scoreboard board = getOrCreate(player);
        board.resetPlayerScore(entry, board.getObjective(OBJECTIVE_NAME));
    }

    /** 將 NMS Scoreboard 套用至玩家（封包推送）。 */
    public void apply(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        Scoreboard board = getOrCreate(player);
        nms.setServerLevel(nms.serverLevel()); // 觸發重新同步
        // 直接設定 playerScoreboard
        nms.server.getScoreboard();  // 確保 server scoreboard 已初始化
        // 使用 connection 發送 scoreboard 封包
        nms.connection.send(new net.minecraft.network.protocol.game
            .ClientboundSetDisplayObjectivePacket(
                DisplaySlot.SIDEBAR,
                board.getDisplayObjective(DisplaySlot.SIDEBAR)));
    }

    /** 清除玩家計分板資料。 */
    public void remove(Player player) {
        playerBoards.remove(player.getUniqueId());
    }
}
```

### `SidebarDisplay.java`（行內容封裝）

```java
package com.example.display;

import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.scores.DisplaySlot;
import net.minecraft.world.scores.Objective;
import net.minecraft.world.scores.Scoreboard;
import net.minecraft.world.scores.criteria.ObjectiveCriteria;
import org.bukkit.craftbukkit.v1_21_R1.entity.CraftPlayer;
import org.bukkit.entity.Player;

import java.util.LinkedHashMap;
import java.util.Map;

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

    /** 建立 NMS Scoreboard 並推送給玩家。 */
    public void show(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        Scoreboard board = new Scoreboard();

        Objective obj = board.addObjective(
            "mps_sb_" + player.getName().hashCode(),
            ObjectiveCriteria.DUMMY,
            Component.literal(title),
            ObjectiveCriteria.RenderType.INTEGER,
            true, null
        );
        board.setDisplayObjective(DisplaySlot.SIDEBAR, obj);

        for (Map.Entry<String, Integer> entry : lines.entrySet()) {
            board.getOrCreatePlayerScore(entry.getKey(), obj).setScore(entry.getValue());
        }

        // 推送所有 scoreboard 封包
        for (var packet : board.getStartTrackingPackets(obj)) {
            nms.connection.send(packet);
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
import org.bukkit.craftbukkit.v1_21_R1.CraftServer;
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
