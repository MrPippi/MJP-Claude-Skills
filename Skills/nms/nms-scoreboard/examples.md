# examples — nms-scoreboard

## Example 1: Show a player stats sidebar

**Input:**
```
package_name: com.example.display
manager_class_name: ScoreboardManager
display_slot: sidebar
per_player: true
```

**Output — create and update the sidebar in PlayerJoinEvent:**
```java
@EventHandler
public void onJoin(PlayerJoinEvent event) {
    Player player = event.getPlayer();
    // Show the initial sidebar
    new SidebarDisplay("§6§lMyServer")
        .addLine("§7─────────────", 15)
        .addLine("§fPlayer: §e" + player.getName(), 14)
        .addLine("§fLevel: §a1", 13)
        .addLine("§fCoins: §60", 12)
        .addLine("§7─────────────", 11)
        .addLine("§7play.example.com", 0)
        .show(player);
}
```

---

## Example 2: Dynamically update sidebar scores

**Input:**
```
package_name: com.example.display
per_player: true
```

**Output — update the player's coin display every 5 seconds:**
```java
private final ScoreboardManager sbManager = new ScoreboardManager();

// Start the repeating task in onEnable
Bukkit.getScheduler().runTaskTimer(plugin, () -> {
    for (Player player : Bukkit.getOnlinePlayers()) {
        int coins = economy.getBalance(player);
        sbManager.setLine(player, "§fCoins: §6" + coins, 12);
    }
}, 0L, 100L); // Every 100 ticks (5 seconds)

// Clean up when the player leaves
@EventHandler
public void onQuit(PlayerQuitEvent event) {
    sbManager.remove(event.getPlayer());
}
```

---

## Example 3: Team prefix/suffix for rank display

**Input:**
```
package_name: com.example.display
```

**Output — set the tablist prefix by player rank:**
```java
private final TeamManager teamManager = new TeamManager();

public void setPlayerRank(Player player, String rank, String color) {
    String teamName = "rank_" + rank;
    // Create the team and set the prefix
    teamManager.setTeam(teamName, color + "[" + rank + "] ", "");
    // Add the player to the team
    teamManager.addPlayer(player, teamName);
}

// Usage
setPlayerRank(player, "VIP", "§6");    // Gold [VIP]
setPlayerRank(player, "Admin", "§c");  // Red [Admin]
setPlayerRank(player, "Member", "§7"); // Gray [Member]
```

---

## Example 4: Remove the sidebar (reset on player death)

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

    // Show again 60 ticks after death
    Bukkit.getScheduler().runTaskLater(plugin, () -> {
        if (player.isOnline()) {
            new SidebarDisplay("§6§lMyServer")
                .addLine("§cYou have died!", 10)
                .show(player);
        }
    }, 60L);
}
```
