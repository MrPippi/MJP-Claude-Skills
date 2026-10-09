---
name: nms-boss-event
description: "透過 NMS ServerBossEvent 操作 Boss Bar 進度條、顏色、風格、可見性，實現每人獨立 Boss Bar（Paper NMS + Mojang-mapped）/ Operate Boss Bar progress, color, style, and per-player visibility via NMS ServerBossEvent"
---

# NMS Boss Event / NMS Boss Bar 操作

## 技能名稱 / Skill Name

`nms-boss-event`

## 目的 / Purpose

透過 NMS `ServerBossEvent` 精確控制 Boss Bar 的進度、顏色、風格（分段線）、可見性，並實現每位玩家獨立的 Boss Bar 內容（Bukkit BossBar API 每個 Bar 對所有玩家相同）。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21 – 1.21.3
- Paperweight userdev 1.7.2+
- Mojang mappings（已由 Paper 1.20.5+ 原生支援）

## 觸發條件 / Triggers

- 「boss bar」「BossEvent」「boss 進度條」「NMS boss bar」「伺服器 boss bar」
- 「ServerBossEvent」「per-player boss bar」「每人 boss bar」「boss overlay」
- 「boss 顏色」「boss 風格」「boss 分段」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.display` | 產出類別所在 package |
| `class_name` | `BossBarManager` | 管理器類名稱 |
| `per_player` | `true` | 是否每人獨立 Boss Bar |

## 輸出產物 / Outputs

- `BossBarManager.java` — Boss Bar 建立與管理
- `NmsBossBar.java` — 單一 ServerBossEvent 封裝

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}
```

## 代碼範本 / Code Template

### `NmsBossBar.java`（單一 Boss Bar 封裝）

```java
package com.example.display;

import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.BossEvent;
import org.bukkit.craftbukkit.v1_21_R1.entity.CraftPlayer;
import org.bukkit.entity.Player;

@SuppressWarnings("UnstableApiUsage")
public class NmsBossBar {

    private final ServerBossEvent bossEvent;

    /**
     * 建立 NMS ServerBossEvent。
     *
     * @param title  顯示標題
     * @param color  BossEvent.BossBarColor（PINK, BLUE, RED, GREEN, YELLOW, PURPLE, WHITE）
     * @param overlay BossEvent.BossBarOverlay（PROGRESS, NOTCHED_6, NOTCHED_10, NOTCHED_12, NOTCHED_20）
     */
    public NmsBossBar(String title, BossEvent.BossBarColor color,
                      BossEvent.BossBarOverlay overlay) {
        this.bossEvent = new ServerBossEvent(
            Component.literal(title),
            color,
            overlay
        );
    }

    /** 設定進度（0.0 - 1.0）。 */
    public void setProgress(float progress) {
        bossEvent.setProgress(Math.max(0f, Math.min(1f, progress)));
    }

    /** 設定顯示標題。 */
    public void setTitle(String title) {
        bossEvent.setName(Component.literal(title));
    }

    /** 設定顏色。 */
    public void setColor(BossEvent.BossBarColor color) {
        bossEvent.setColor(color);
    }

    /** 設定風格（分段線）。 */
    public void setOverlay(BossEvent.BossBarOverlay overlay) {
        bossEvent.setOverlay(overlay);
    }

    /** 設定是否顯示（全部已添加的玩家）。 */
    public void setVisible(boolean visible) {
        bossEvent.setVisible(visible);
    }

    /** 設定是否播放霧氣效果（黑暗化螢幕）。 */
    public void setDarkenScreen(boolean darken) {
        bossEvent.setDarkenScreen(darken);
    }

    /** 設定是否播放 Boss 音樂。 */
    public void setPlayBossMusic(boolean play) {
        bossEvent.setPlayBossMusic(play);
    }

    /** 添加玩家（顯示 Boss Bar 給此玩家）。 */
    public void addPlayer(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        bossEvent.addPlayer(nms);
    }

    /** 移除玩家（隱藏 Boss Bar）。 */
    public void removePlayer(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        bossEvent.removePlayer(nms);
    }

    /** 移除所有玩家。 */
    public void removeAllPlayers() {
        bossEvent.removeAllPlayers();
    }

    /** 取得底層 ServerBossEvent（供進階操作）。 */
    public ServerBossEvent getHandle() {
        return bossEvent;
    }
}
```

### `BossBarManager.java`（每人獨立 Boss Bar 管理器）

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

    /** 取得或建立玩家的 Boss Bar。 */
    public NmsBossBar getOrCreate(Player player, String title,
                                  BossEvent.BossBarColor color,
                                  BossEvent.BossBarOverlay overlay) {
        return playerBars.computeIfAbsent(player.getUniqueId(), k -> {
            NmsBossBar bar = new NmsBossBar(title, color, overlay);
            bar.addPlayer(player);
            return bar;
        });
    }

    /** 更新玩家 Boss Bar 標題與進度。 */
    public void update(Player player, String title, float progress) {
        NmsBossBar bar = playerBars.get(player.getUniqueId());
        if (bar == null) return;
        bar.setTitle(title);
        bar.setProgress(progress);
    }

    /** 移除玩家的 Boss Bar。 */
    public void remove(Player player) {
        NmsBossBar bar = playerBars.remove(player.getUniqueId());
        if (bar != null) bar.removePlayer(player);
    }

    /** 移除所有 Boss Bar。 */
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

### 使用範例

```java
// 初始化管理器
BossBarManager manager = new BossBarManager(plugin);

// 建立玩家 Boss Bar（每人獨立）
NmsBossBar bar = manager.getOrCreate(
    player,
    "§6§l任務進度",
    BossEvent.BossBarColor.YELLOW,
    BossEvent.BossBarOverlay.PROGRESS
);

// 更新進度（在主執行緒呼叫）
Bukkit.getScheduler().runTaskTimer(plugin, () -> {
    for (Player p : Bukkit.getOnlinePlayers()) {
        float progress = getPlayerProgress(p); // 0.0 - 1.0
        manager.update(p, "§6§l任務進度: " + (int)(progress * 100) + "%", progress);
    }
}, 0L, 20L);
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── display/
    ├── NmsBossBar.java
    └── BossBarManager.java
```

## 執行緒安全注意事項 / Thread Safety

- ⚠️ `addPlayer()`、`removePlayer()`、`setProgress()` 等 `ServerBossEvent` 操作**必須在主執行緒呼叫**
- ✅ `BossBarManager` 的事件回呼（PlayerQuitEvent）已在主執行緒觸發，安全
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| Boss Bar 不顯示 | `addPlayer()` 未呼叫 | 確認 `getOrCreate()` 或 `addPlayer()` 有執行 |
| 玩家重新加入後 Bar 消失 | 未處理 PlayerJoinEvent | 在 PlayerJoinEvent 中重新 `addPlayer()` |
| 進度超出範圍崩潰 | progress > 1.0 或 < 0.0 | `setProgress` 已做 clamp，確認傳入值正確 |
| 記憶體洩漏（玩家離線後仍持有） | 未監聽 PlayerQuitEvent | 使用 `BossBarManager`（已內建 `@EventHandler`） |
