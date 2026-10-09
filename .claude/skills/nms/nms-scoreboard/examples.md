# examples — nms-scoreboard

## 範例 1：顯示玩家統計 Sidebar

**Input:**
```
package_name: com.example.display
manager_class_name: ScoreboardManager
display_slot: sidebar
per_player: true
```

**Output — 在 PlayerJoinEvent 建立並更新 Sidebar:**
```java
@EventHandler
public void onJoin(PlayerJoinEvent event) {
    Player player = event.getPlayer();
    // 顯示初始 sidebar
    new SidebarDisplay("§6§lMyServer")
        .addLine("§7─────────────", 15)
        .addLine("§f玩家: §e" + player.getName(), 14)
        .addLine("§f等級: §a1", 13)
        .addLine("§f金幣: §60", 12)
        .addLine("§7─────────────", 11)
        .addLine("§7play.example.com", 0)
        .show(player);
}
```

---

## 範例 2：動態更新 Sidebar 分數

**Input:**
```
package_name: com.example.display
per_player: true
```

**Output — 每 5 秒更新玩家的金幣顯示:**
```java
private final ScoreboardManager sbManager = new ScoreboardManager();

// 在 onEnable 中啟動定時任務
Bukkit.getScheduler().runTaskTimer(plugin, () -> {
    for (Player player : Bukkit.getOnlinePlayers()) {
        int coins = economy.getBalance(player);
        sbManager.setLine(player, "§f金幣: §6" + coins, 12);
    }
}, 0L, 100L); // 每 100 tick（5 秒）

// 玩家離開時清理
@EventHandler
public void onQuit(PlayerQuitEvent event) {
    sbManager.remove(event.getPlayer());
}
```

---

## 範例 3：Team prefix/suffix 設定等級顯示

**Input:**
```
package_name: com.example.display
```

**Output — 依玩家等級設定 tablist prefix:**
```java
private final TeamManager teamManager = new TeamManager();

public void setPlayerRank(Player player, String rank, String color) {
    String teamName = "rank_" + rank;
    // 建立 team 並設定 prefix
    teamManager.setTeam(teamName, color + "[" + rank + "] ", "");
    // 將玩家加入 team
    teamManager.addPlayer(player, teamName);
}

// 使用
setPlayerRank(player, "VIP", "§6");    // 金色 [VIP]
setPlayerRank(player, "Admin", "§c");  // 紅色 [Admin]
setPlayerRank(player, "Member", "§7"); // 灰色 [Member]
```

---

## 範例 4：移除 Sidebar（玩家死亡時重置）

**Input:**
```
package_name: com.example.display
```

**Output:**
```java
@EventHandler
public void onDeath(PlayerDeathEvent event) {
    Player player = event.getEntity();
    sbManager.remove(player);

    // 死亡後 60 tick 重新顯示
    Bukkit.getScheduler().runTaskLater(plugin, () -> {
        if (player.isOnline()) {
            new SidebarDisplay("§6§lMyServer")
                .addLine("§c你已死亡！", 10)
                .show(player);
        }
    }, 60L);
}
```
