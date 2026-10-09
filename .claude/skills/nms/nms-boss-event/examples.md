# examples — nms-boss-event

## 範例 1：顯示任務進度 Boss Bar

**Input:**
```
package_name: com.example.display
per_player: true
```

**Output — 玩家進入任務區域時顯示 Boss Bar:**
```java
private final BossBarManager bossBarManager = new BossBarManager(plugin);

@EventHandler
public void onEnterZone(PlayerMoveEvent event) {
    Player player = event.getPlayer();
    if (!isInQuestZone(player.getLocation())) return;

    NmsBossBar bar = bossBarManager.getOrCreate(
        player,
        "§6§l主線任務：尋找神器",
        BossEvent.BossBarColor.YELLOW,
        BossEvent.BossBarOverlay.PROGRESS
    );
    bar.setProgress(getQuestProgress(player)); // 0.0 - 1.0
}

@EventHandler
public void onLeaveZone(PlayerMoveEvent event) {
    // 離開任務區域時隱藏 Bar（不移除，保留狀態）
    NmsBossBar bar = bossBarManager.getOrCreate(
        event.getPlayer(), "", BossEvent.BossBarColor.YELLOW, BossEvent.BossBarOverlay.PROGRESS);
    bar.setVisible(!isOutsideZone(event.getPlayer().getLocation()));
}
```

---

## 範例 2：每秒更新 Boss Bar 進度

**Input:**
```
package_name: com.example.display
```

**Output — 競速倒計時 Boss Bar:**
```java
int duration = 60; // 60 秒

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
        String title = "§c⏱ 剩餘時間: §f" + remaining + "§c 秒";

        for (Player p : Bukkit.getOnlinePlayers()) {
            bossBarManager.update(p, title, progress);
        }
        remaining--;
    }
}, 0L, 20L);
```

---

## 範例 3：Boss 戰 HP 顯示

**Input:**
```
package_name: com.example.display
per_player: false
```

**Output — 全伺服器共享 Boss HP 顯示（單一 ServerBossEvent 對多玩家）:**
```java
// 建立共享 Boss Bar
NmsBossBar bossBar = new NmsBossBar(
    "§4§l深淵巨龍 — 100%",
    BossEvent.BossBarColor.RED,
    BossEvent.BossBarOverlay.NOTCHED_20
);
bossBar.setDarkenScreen(true);    // 暗化螢幕
bossBar.setPlayBossMusic(true);   // 播放 Boss 音樂

// 對全服玩家顯示
for (Player p : Bukkit.getOnlinePlayers()) {
    bossBar.addPlayer(p);
}

// Boss 受傷時更新
void onBossDamage(double currentHp, double maxHp) {
    float progress = (float) (currentHp / maxHp);
    int percent = (int) (progress * 100);
    bossBar.setProgress(progress);
    bossBar.setTitle("§4§l深淵巨龍 — " + percent + "%");

    // HP 低於 50% 轉為黃色
    if (progress < 0.5f) {
        bossBar.setColor(BossEvent.BossBarColor.YELLOW);
    }
    // HP 低於 20% 轉為白色閃爍（實際上改標題顏色）
    if (progress < 0.2f) {
        bossBar.setColor(BossEvent.BossBarColor.WHITE);
    }
}

// Boss 死亡時移除
void onBossDeath() {
    bossBar.removeAllPlayers();
}
```

---

## 範例 4：每人獨立進度的多任務系統

**Input:**
```
package_name: com.example.display
per_player: true
```

**Output — 每個玩家看到不同的任務進度:**
```java
// 更新所有玩家的個人任務進度
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
