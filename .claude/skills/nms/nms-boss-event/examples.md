# examples — nms-boss-event

## Example 1: Show a quest progress Boss Bar

**Input:**
```
package_name: com.example.display
per_player: true
```

**Output — show a Boss Bar when a player enters the quest zone:**
```java
private final BossBarManager bossBarManager = new BossBarManager(plugin);

@EventHandler
public void onEnterZone(PlayerMoveEvent event) {
    Player player = event.getPlayer();
    if (!isInQuestZone(player.getLocation())) return;

    NmsBossBar bar = bossBarManager.getOrCreate(
        player,
        "§6§lMain Quest: Find the Artifact",
        BossEvent.BossBarColor.YELLOW,
        BossEvent.BossBarOverlay.PROGRESS
    );
    bar.setProgress(getQuestProgress(player)); // 0.0 - 1.0
}

@EventHandler
public void onLeaveZone(PlayerMoveEvent event) {
    // Hide the bar when leaving the quest zone (do not remove it; keep its state)
    NmsBossBar bar = bossBarManager.getOrCreate(
        event.getPlayer(), "", BossEvent.BossBarColor.YELLOW, BossEvent.BossBarOverlay.PROGRESS);
    bar.setVisible(!isOutsideZone(event.getPlayer().getLocation()));
}
```

---

## Example 2: Update Boss Bar progress every second

**Input:**
```
package_name: com.example.display
```

**Output — race countdown Boss Bar:**
```java
int duration = 60; // 60 seconds

Bukkit.getScheduler().runTaskTimer(plugin, new BukkitRunnable() {
    int remaining = duration;

    @Override
    public void run() {
        if (remaining <= 0) {
            bossBarManager.removeAll();
            cancel();
            return;
        }

        float progress = (float) remaining / duration;
        String title = "§c⏱ Time left: §f" + remaining + "§c s";

        for (Player p : Bukkit.getOnlinePlayers()) {
            bossBarManager.update(p, title, progress);
        }
        remaining--;
    }
}, 0L, 20L);
```

---

## Example 3: Boss fight HP display

**Input:**
```
package_name: com.example.display
per_player: false
```

**Output — server-wide shared boss HP display (a single ServerBossEvent for many players):**
```java
// Create the shared Boss Bar
NmsBossBar bossBar = new NmsBossBar(
    "§4§lAbyssal Dragon — 100%",
    BossEvent.BossBarColor.RED,
    BossEvent.BossBarOverlay.NOTCHED_20
);
bossBar.setDarkenScreen(true);    // Darken the screen
bossBar.setPlayBossMusic(true);   // Play boss music

// Show to all players on the server
for (Player p : Bukkit.getOnlinePlayers()) {
    bossBar.addPlayer(p);
}

// Update when the boss takes damage
void onBossDamage(double currentHp, double maxHp) {
    float progress = (float) (currentHp / maxHp);
    int percent = (int) (progress * 100);
    bossBar.setProgress(progress);
    bossBar.setTitle("§4§lAbyssal Dragon — " + percent + "%");

    // Turn yellow when HP drops below 50%
    if (progress < 0.5f) {
        bossBar.setColor(BossEvent.BossBarColor.YELLOW);
    }
    // Turn white when HP drops below 20% (flashing effect; in practice this just changes the bar color)
    if (progress < 0.2f) {
        bossBar.setColor(BossEvent.BossBarColor.WHITE);
    }
}

// Remove when the boss dies
void onBossDeath() {
    bossBar.removeAllPlayers();
}
```

---

## Example 4: Multi-quest system with per-player progress

**Input:**
```
package_name: com.example.display
per_player: true
```

**Output — each player sees different quest progress:**
```java
// Refresh every player's personal quest progress
public void refreshAllBars() {
    for (Player player : Bukkit.getOnlinePlayers()) {
        Quest quest = questManager.getActiveQuest(player);
        if (quest == null) {
            bossBarManager.remove(player);
            continue;
        }

        String title = "§b§l" + quest.getName() + " §7(" +
            quest.getCompleted() + "/" + quest.getTotal() + ")";
        float progress = (float) quest.getCompleted() / quest.getTotal();

        bossBarManager.update(player, title, progress);
    }
}
```
