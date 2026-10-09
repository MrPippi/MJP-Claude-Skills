---
name: paper-client-side-effects
description: "只用 Paper API 做每位玩家各自看到的錯覺：虛擬世界邊界紅框、個人時間／天氣、hidePlayer 可見性、夜視並在事件後重新套用 / Per-player illusions with Paper API only: virtual world border vignette, personal time/weather, hidePlayer visibility, night vision with reconcile-after-event"
---

# Paper Client-Side Effects / 玩家端視覺效果

## 技能名稱 / Skill Name

`paper-client-side-effects`

## 目的 / Purpose

需要「只有某位玩家看得到」的效果時（低血量紅框、個人時間／天氣、在大廳隱藏其他玩家、被動夜視），**先用 Paper API，再考慮封包或 NMS**。這些效果都有現成方法，不需要 `nms-packet-sender`：

| 效果 | API | 清除方式 |
|------|-----|----------|
| 紅色暈影 | `Server#createWorldBorder` + `Player#setWorldBorder` | `setWorldBorder(null)` |
| 個人時間 | `Player#setPlayerTime(long, boolean)` | `resetPlayerTime()` |
| 個人天氣 | `Player#setPlayerWeather(WeatherType)` | `resetPlayerWeather()` |
| 隱藏玩家 | `Player#hidePlayer(Plugin, Player)` | `showPlayer(Plugin, Player)` |
| 夜視 | `addPotionEffect` 無限時長 | 事件後 `reconcile()` 重新套用 |

這類 bug 的共同根源是「**套上去之後被別人悄悄拿掉或換掉**」：真邊界變了、玩家換世界、死亡重生、喝牛奶、`/effect clear`。解法是把「想要的狀態」放在中央的 `EffectState`，每個觸發事件之後呼叫 `reconcile()` 重新套用，而不是在每個事件裡各自補洞。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（本技能用到的方法與事件兩版簽名相同，皆經編譯驗證）
- 純 Paper API，不需要 Paperweight、不需要 ProtocolLib／PacketEvents

## 觸發條件 / Triggers

- 「虛擬世界邊界」「紅色邊框」「低血量紅框」「virtual world border」「warning distance」
- 「個人時間」「個人天氣」「setPlayerTime」「setPlayerWeather」
- 「隱藏玩家」「hidePlayer」「大廳顯示玩家」「per-viewer visibility」
- 「夜視被牛奶清掉」「EntityPotionEffectEvent」「重新套用效果」「restore effect」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `base_package` | `com.example.effects` | 輸出 package |
| `low_health_threshold` | `8.0` | 低於此血量開始紅框（半顆心為 1） |
| `effects` | `border, time, weather, night-vision, visibility` | 需要哪些效果 |
| `preference_source` | `SettingsApi`（見 `paper-service-api`） | 玩家偏好從哪裡來 |
| `visibility_rule` | 只在大廳隱藏非好友 | 決定「誰看不到誰」 |

## 輸出產物 / Outputs

- `EffectPrefs.java` — 單一玩家的偏好（不可變 record + enum）
- `EffectPreferences.java` — 偏好來源介面
- `BorderTint.java` — 紅框強度與警告距離的純計算
- `LowHealthBorderEffect.java` — 虛擬邊界的套用／清除
- `PersonalTimeWeatherEffect.java` — 個人時間與天氣
- `NightVisionEffect.java` — 無限夜視
- `EffectState.java` — 中央狀態與 `reconcile()`
- `EffectListener.java` — 觸發 `reconcile()` 的事件
- `PlayerVisibilityService.java` — 外掛範圍的 `hidePlayer`
- `SettingsApi.java` / `SettingsHook.java` — 偏好來源接點（見 `paper-service-api`）
- `EffectsPlugin.java` — 組裝

## 建置設定 / Build Setup

見 [`Skills/paper-api/PLATFORM.md`](../../paper-api/PLATFORM.md)。只需要 `paper-api`：

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
}
```

## 代碼範本 / Code Template

### `EffectPrefs.java`（偏好，不可變）

```java
package com.example.effects;

/** 單一玩家想要的效果。不可變：改偏好就產生新的 record。 */
public record EffectPrefs(
    boolean lowHealthBorder,
    boolean nightVision,
    TimePreset time,
    WeatherPreset weather
) {

    /** 沒有任何偏好（全部關閉、時間天氣跟隨伺服器）。 */
    public static final EffectPrefs NONE =
        new EffectPrefs(false, false, TimePreset.SERVER, WeatherPreset.SERVER);

    /** 個人時間。{@code relative=false} 固定在該時刻；{@code true} 是相對伺服器時間的位移（仍會流動）。 */
    public enum TimePreset {
        SERVER(0L, true),
        DAWN(0L, false),
        NOON(6000L, false),
        DUSK(12000L, false),
        MIDNIGHT(18000L, false),
        AHEAD_6H(6000L, true);

        private final long ticks;
        private final boolean relative;

        TimePreset(long ticks, boolean relative) {
            this.ticks = ticks;
            this.relative = relative;
        }

        public long ticks() {
            return ticks;
        }

        public boolean relative() {
            return relative;
        }
    }

    public enum WeatherPreset {
        SERVER,
        CLEAR,
        RAIN
    }
}
```

### `EffectPreferences.java`（偏好來源）

```java
package com.example.effects;

import java.util.UUID;

/**
 * 玩家偏好的來源。實作只能讀記憶體快取（主執行緒呼叫），不可在這裡做 IO；
 * 取不到時回 {@link EffectPrefs#NONE}。
 */
@FunctionalInterface
public interface EffectPreferences {

    EffectPrefs prefsOf(UUID player);
}
```

### `BorderTint.java`（紅框計算，純函式）

```java
package com.example.effects;

/**
 * 紅框怎麼算。客戶端在「離邊界的距離 &lt; 警告距離」時畫紅色暈影，強度約為 1 - 距離 / 警告距離，
 * 所以把警告距離設成「距離 / (1 - 想要的強度)」就能控制深淺。無 Bukkit 依賴，可直接單元測試。
 */
public final class BorderTint {

    private static final double[] INTENSITY = {0.0, 0.25, 0.5, 0.75};
    private static final int MAX_WARNING_DISTANCE = 29_999_984;
    private static final int RESEND_THRESHOLD = 2;

    private BorderTint() {}

    /** 上次送出（或這次想送）的內容；{@link #NONE} 代表玩家看的是真邊界。 */
    public record Sent(int level, int warningDistance, double size, double centerX, double centerZ) {
        public static final Sent NONE = new Sent(0, 0, 0.0, 0.0, 0.0);
    }

    /** 0 = 不顯示；1..3 = 越低血越深。 */
    public static int level(double health, double threshold) {
        if (threshold <= 0.0 || health >= threshold) return 0;
        double ratio = health / threshold;
        if (ratio <= 1.0 / 3.0) return 3;
        if (ratio <= 2.0 / 3.0) return 2;
        return 1;
    }

    public static double distanceToEdge(double x, double z, double centerX, double centerZ, double size) {
        double half = size / 2.0;
        double edge = Math.min(half - Math.abs(x - centerX), half - Math.abs(z - centerZ));
        return Math.max(0.0, edge);
    }

    public static int warningDistance(int level, double distanceToEdge) {
        double intensity = INTENSITY[Math.max(0, Math.min(level, INTENSITY.length - 1))];
        double wanted = Math.ceil(distanceToEdge / (1.0 - intensity));
        return (int) Math.max(1.0, Math.min(wanted, MAX_WARNING_DISTANCE));
    }

    /** 級數、邊界大小／中心變了，或警告距離差到看得出來才重送，避免每次掃描都發封包。 */
    public static boolean needsResend(Sent last, Sent target) {
        return last.level() != target.level()
            || Double.compare(last.size(), target.size()) != 0
            || Double.compare(last.centerX(), target.centerX()) != 0
            || Double.compare(last.centerZ(), target.centerZ()) != 0
            || Math.abs(last.warningDistance() - target.warningDistance()) >= RESEND_THRESHOLD;
    }
}
```

### `LowHealthBorderEffect.java`（虛擬邊界）

```java
package com.example.effects;

import org.bukkit.Location;
import org.bukkit.Server;
import org.bukkit.WorldBorder;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 低血量紅框。虛擬邊界抄玩家所在世界真邊界的中心與大小，只改警告距離，
 * 所以擋人的仍是伺服器上的真邊界，虛擬邊界只影響畫面。
 *
 * <p>不在 {@link #sent} 裡＝玩家看的是真邊界。只在主執行緒碰。
 */
public final class LowHealthBorderEffect {

    private final Server server;
    private final double threshold;
    private final Map<UUID, BorderTint.Sent> sent = new HashMap<>();

    public LowHealthBorderEffect(Server server, double threshold) {
        this.server = server;
        this.threshold = threshold;
    }

    /** 冪等：可在定時器與任何 reconcile 裡呼叫，只有內容變了才真的送。 */
    public void apply(Player player, boolean enabled) {
        UUID id = player.getUniqueId();
        int level = enabled ? BorderTint.level(player.getHealth(), threshold) : 0;
        if (level == 0) {
            if (sent.containsKey(id)) clear(player);
            return;
        }
        WorldBorder real = player.getWorld().getWorldBorder();
        Location center = real.getCenter();
        Location at = player.getLocation();
        double distance = BorderTint.distanceToEdge(at.getX(), at.getZ(), center.getX(), center.getZ(), real.getSize());
        BorderTint.Sent target = new BorderTint.Sent(level, BorderTint.warningDistance(level, distance),
            real.getSize(), center.getX(), center.getZ());
        if (!BorderTint.needsResend(sent.getOrDefault(id, BorderTint.Sent.NONE), target)) return;

        WorldBorder virtual = server.createWorldBorder();
        virtual.setCenter(target.centerX(), target.centerZ());
        virtual.setSize(target.size());
        virtual.setWarningDistance(target.warningDistance());
        player.setWorldBorder(virtual);
        sent.put(id, target);
    }

    /** 換回真邊界。換世界時一定要先呼叫：手上的虛擬邊界抄的是舊世界。 */
    public void clear(Player player) {
        player.setWorldBorder(null);
        sent.remove(player.getUniqueId());
    }

    /** 只忘記紀錄（玩家登出時用；虛擬邊界不跟著存檔）。 */
    public void forget(UUID player) {
        sent.remove(player);
    }

    /** 停用時把每個人換回真邊界，否則紅框會留到他們下次換世界或重登。 */
    public void clearAll() {
        for (UUID id : Map.copyOf(sent).keySet()) {
            Player player = server.getPlayer(id);
            if (player != null) player.setWorldBorder(null);
        }
        sent.clear();
    }
}
```

### `PersonalTimeWeatherEffect.java`（個人時間與天氣）

```java
package com.example.effects;

import org.bukkit.WeatherType;
import org.bukkit.entity.Player;

/**
 * 個人時間與天氣。兩者是玩家身上的欄位：換世界、死亡都不會清，登出就沒了（不進 playerdata）。
 * 仍放進 reconcile：其他插件也可能呼叫 reset，重複套用只是多送一個小封包。
 */
public final class PersonalTimeWeatherEffect {

    public void apply(Player player, EffectPrefs prefs) {
        EffectPrefs.TimePreset time = prefs.time();
        if (time == EffectPrefs.TimePreset.SERVER) {
            player.resetPlayerTime();
        } else {
            // relative=false：固定在該時刻；relative=true：相對伺服器時間的位移
            player.setPlayerTime(time.ticks(), time.relative());
        }

        switch (prefs.weather()) {
            case SERVER -> player.resetPlayerWeather();
            case CLEAR -> player.setPlayerWeather(WeatherType.CLEAR);
            case RAIN -> player.setPlayerWeather(WeatherType.DOWNFALL);
        }
    }

    public void clear(Player player) {
        player.resetPlayerTime();
        player.resetPlayerWeather();
    }
}
```

### `NightVisionEffect.java`（被動夜視）

```java
package com.example.effects;

import org.bukkit.entity.Player;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

/** 無限、環境（ambient）、無粒子、無圖示的夜視：看起來像被動 buff，而不是一瓶藥水。 */
public final class NightVisionEffect {

    public void apply(Player player) {
        if (isActive(player)) return;
        player.addPotionEffect(new PotionEffect(PotionEffectType.NIGHT_VISION,
            PotionEffect.INFINITE_DURATION, 0, true, false, false));
    }

    public void remove(Player player) {
        player.removePotionEffect(PotionEffectType.NIGHT_VISION);
    }

    /**
     * 玩家身上是否已經是「我們的」無限夜視 —— 不是任何夜視都算。
     * 只檢查「有沒有」會誤判：玩家關閉偏好時喝了有限時長的夜視藥水，之後打開偏好看到「已有夜視」就跳過，
     * 藥水一到期就失去夜視（EXPIRATION 不是需要攔的清除原因）。檢查 {@code isInfinite()} 才會立刻覆蓋成永久。
     */
    public boolean isActive(Player player) {
        PotionEffect effect = player.getPotionEffect(PotionEffectType.NIGHT_VISION);
        return effect != null && effect.isInfinite();
    }
}
```

### `EffectState.java`（中央狀態與 reconcile）

```java
package com.example.effects;

import org.bukkit.Server;
import org.bukkit.World;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 每位玩家「想要的效果」的唯一來源，以及把它重新套用到玩家身上的 {@link #reconcile}。
 * 所有觸發事件（加入、換世界、重生、真邊界變動、效果被移除）都只做一件事：呼叫 reconcile，
 * 不在各個事件裡各自補洞。只在主執行緒碰；沒有 static 可變狀態。
 */
public final class EffectState {

    private final Server server;
    private final EffectPreferences preferences;
    private final LowHealthBorderEffect border;
    private final PersonalTimeWeatherEffect timeWeather;
    private final NightVisionEffect nightVision;
    private final Map<UUID, EffectPrefs> desired = new HashMap<>();

    public EffectState(Server server, EffectPreferences preferences, LowHealthBorderEffect border,
                       PersonalTimeWeatherEffect timeWeather, NightVisionEffect nightVision) {
        this.server = server;
        this.preferences = preferences;
        this.border = border;
        this.timeWeather = timeWeather;
        this.nightVision = nightVision;
    }

    /** 從偏好來源重新讀取並套用（登入、設定頁切換之後呼叫）。 */
    public void refresh(Player player) {
        desired.put(player.getUniqueId(), preferences.prefsOf(player.getUniqueId()));
        reconcile(player);
    }

    /** 把「想要的狀態」重新套用到玩家身上。冪等，可重複呼叫。 */
    public void reconcile(Player player) {
        if (!player.isOnline()) return;
        EffectPrefs prefs = desired.getOrDefault(player.getUniqueId(), EffectPrefs.NONE);
        border.apply(player, prefs.lowHealthBorder());
        timeWeather.apply(player, prefs);
        if (prefs.nightVision()) {
            nightVision.apply(player);
        } else if (nightVision.isActive(player)) {
            nightVision.remove(player); // 只移除我們的無限夜視，不動別人給的有限藥水
        }
    }

    /** 換世界：舊世界的虛擬邊界先清掉，再依新世界的真邊界重算。 */
    public void worldChanged(Player player) {
        border.clear(player);
        reconcile(player);
    }

    /** 某個世界的真邊界變了：該世界所有玩家的虛擬邊界都要重抄。 */
    public void realBorderChanged(World world) {
        for (Player player : world.getPlayers()) {
            border.clear(player);
            reconcile(player);
        }
    }

    /** 定時掃描：血量變化沒有事件（setHealth 不發事件），只有邊界需要追。 */
    public void tick() {
        for (Player player : server.getOnlinePlayers()) {
            EffectPrefs prefs = desired.getOrDefault(player.getUniqueId(), EffectPrefs.NONE);
            border.apply(player, prefs.lowHealthBorder());
        }
    }

    /** 此玩家目前是否想要夜視（給事件過濾用）。 */
    public boolean wantsNightVision(UUID player) {
        return desired.getOrDefault(player, EffectPrefs.NONE).nightVision();
    }

    public void forget(UUID player) {
        desired.remove(player);
        border.forget(player);
    }

    /** 停用：虛擬邊界、個人時間天氣、我們的夜視全部還原。 */
    public void restoreAll() {
        border.clearAll();
        for (Player player : server.getOnlinePlayers()) {
            timeWeather.clear(player);
            if (nightVision.isActive(player)) nightVision.remove(player);
        }
        desired.clear();
    }
}
```

### `EffectListener.java`（觸發 reconcile 的事件）

```java
package com.example.effects;

import io.papermc.paper.event.world.border.WorldBorderBoundsChangeEvent;
import io.papermc.paper.event.world.border.WorldBorderBoundsChangeFinishEvent;
import io.papermc.paper.event.world.border.WorldBorderCenterChangeEvent;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityPotionEffectEvent;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.plugin.Plugin;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

import java.util.UUID;

/**
 * 每個事件只做一件事：排到「下一 tick」呼叫 reconcile。
 * 不在事件當下改效果：事件發生時狀態還沒落定（真邊界尚未改、藥水尚未移除、玩家尚未重生完成），
 * 在 {@link EntityPotionEffectEvent} 裡直接 add 同一個效果也容易互相觸發。
 */
public final class EffectListener implements Listener {

    private final Plugin plugin;
    private final EffectState state;
    private final PlayerVisibilityService visibility;

    public EffectListener(Plugin plugin, EffectState state, PlayerVisibilityService visibility) {
        this.plugin = plugin;
        this.state = state;
        this.visibility = visibility;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        later(() -> {
            state.refresh(player);
            visibility.joined(player); // 新玩家 ↔ 既有玩家，兩個方向都重算
        });
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        visibility.quit(event.getPlayer()); // 先放出來再忘記
        state.forget(event.getPlayer().getUniqueId());
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onWorldChange(PlayerChangedWorldEvent event) {
        Player player = event.getPlayer();
        later(() -> {
            state.worldChanged(player);
            visibility.refreshAll(); // 規則可能依世界而定
        });
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onRespawn(PlayerRespawnEvent event) {
        Player player = event.getPlayer();
        later(() -> state.worldChanged(player)); // 重生可能跨世界；死亡也清掉了所有藥水效果
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBorderBounds(WorldBorderBoundsChangeEvent event) {
        World world = event.getWorld();
        later(() -> state.realBorderChanged(world)); // 事件發生時還是舊大小，等下一 tick
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onBorderFinish(WorldBorderBoundsChangeFinishEvent event) {
        World world = event.getWorld();
        later(() -> state.realBorderChanged(world));
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBorderCenter(WorldBorderCenterChangeEvent event) {
        World world = event.getWorld();
        later(() -> state.realBorderChanged(world));
    }

    /** 牛奶、/effect clear、死亡、有限藥水覆蓋：任何讓夜視消失或變成有限的原因。 */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPotionEffect(EntityPotionEffectEvent event) {
        if (!(event.getEntity() instanceof Player player)) return;
        if (!state.wantsNightVision(player.getUniqueId())) return;
        PotionEffectType modified = event.getModifiedType();
        boolean cleared = event.getAction() == EntityPotionEffectEvent.Action.CLEARED;
        if (!cleared && modified != PotionEffectType.NIGHT_VISION) return;
        PotionEffect incoming = event.getNewEffect();
        if (incoming != null && incoming.isInfinite()) return; // 我們自己剛套上去的
        UUID id = player.getUniqueId();
        later(() -> {
            Player current = plugin.getServer().getPlayer(id);
            if (current != null) state.reconcile(current);
        });
    }

    private void later(Runnable task) {
        plugin.getServer().getScheduler().runTask(plugin, task);
    }
}
```

### `PlayerVisibilityService.java`（外掛範圍的隱藏玩家）

```java
package com.example.effects;

import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 依規則替每位觀看者隱藏／顯示其他玩家，用 {@code hidePlayer(plugin, target)}：
 * 隱藏屬於本插件，不會蓋掉其他插件藏的人，也不會被其他插件的 showPlayer 放出來。
 *
 * <p>注意：{@code hidePlayer} 會連 TAB 名單一起移除（Bukkit 行為）。需要保留 TAB 時，改用 TAB 插件自己的可見性，
 * 或接受這個副作用。{@link #hidden} 只在主執行緒碰。
 */
public final class PlayerVisibilityService {

    /** 該不該讓 viewer 看不到 target。 */
    @FunctionalInterface
    public interface Policy {
        boolean shouldHide(Player viewer, Player target);
    }

    private final Plugin plugin;
    private final Policy policy;
    /** 觀看者 → 本插件替他藏著的人。 */
    private final Map<UUID, Set<UUID>> hidden = new HashMap<>();

    public PlayerVisibilityService(Plugin plugin, Policy policy) {
        this.plugin = plugin;
        this.policy = policy;
    }

    /** 重新計算某位觀看者的畫面，只動有變的那幾個人。 */
    public void refresh(Player viewer) {
        Set<UUID> before = hidden.getOrDefault(viewer.getUniqueId(), Set.of());
        Set<UUID> after = new HashSet<>();
        for (Player target : plugin.getServer().getOnlinePlayers()) {
            if (target.equals(viewer)) continue;
            boolean hide = policy.shouldHide(viewer, target);
            if (hide) after.add(target.getUniqueId());
            if (hide && !before.contains(target.getUniqueId())) {
                viewer.hidePlayer(plugin, target);
            } else if (!hide && before.contains(target.getUniqueId())) {
                viewer.showPlayer(plugin, target);
            }
        }
        if (after.isEmpty()) {
            hidden.remove(viewer.getUniqueId());
        } else {
            hidden.put(viewer.getUniqueId(), Set.copyOf(after));
        }
    }

    public void refreshAll() {
        for (Player viewer : plugin.getServer().getOnlinePlayers()) {
            refresh(viewer);
        }
    }

    /**
     * 新玩家加入：他要對既有觀看者隱藏（既有觀看者重算），也要依規則決定他自己看得到誰（他自己重算）。
     * 兩個方向都要做，只做一邊會出現「我看不到他、他卻看得到我」。
     */
    public void joined(Player joined) {
        refresh(joined);
        for (Player viewer : plugin.getServer().getOnlinePlayers()) {
            if (!viewer.equals(joined)) refresh(viewer);
        }
    }

    /**
     * 登出：先把他從每個觀看者那裡放出來再丟掉紀錄。Bukkit 依 UUID 記著隱藏；
     * 若他離線後才放，已經拿不到 Player 物件，重登就會一直是藏的。
     */
    public void quit(Player quitting) {
        UUID id = quitting.getUniqueId();
        hidden.remove(id);
        for (Map.Entry<UUID, Set<UUID>> entry : Map.copyOf(hidden).entrySet()) {
            if (!entry.getValue().contains(id)) continue;
            Player viewer = plugin.getServer().getPlayer(entry.getKey());
            if (viewer != null) viewer.showPlayer(plugin, quitting);
            Set<UUID> rest = new HashSet<>(entry.getValue());
            rest.remove(id);
            if (rest.isEmpty()) {
                hidden.remove(entry.getKey());
            } else {
                hidden.put(entry.getKey(), Set.copyOf(rest));
            }
        }
    }

    /** 停用：全部放出來，否則藏著的人要等到重登才回來。 */
    public void showAll() {
        for (Map.Entry<UUID, Set<UUID>> entry : hidden.entrySet()) {
            Player viewer = plugin.getServer().getPlayer(entry.getKey());
            if (viewer == null) continue;
            for (UUID targetId : entry.getValue()) {
                Player target = plugin.getServer().getPlayer(targetId);
                if (target != null) viewer.showPlayer(plugin, target);
            }
        }
        hidden.clear();
    }
}
```

### `SettingsApi.java`（設定插件的 api，只含 JDK 型別）

```java
package com.example.settings.api;

import java.util.UUID;

/** Settings 插件提供的偏好查詢（只讀記憶體快取，主執行緒呼叫）。見 {@code paper-service-api}。 */
public interface SettingsApi {

    boolean lowHealthBorder(UUID player);

    boolean nightVision(UUID player);

    /** {@code SERVER / DAWN / NOON / DUSK / MIDNIGHT / AHEAD_6H}；其他值視為 SERVER。 */
    String time(UUID player);

    /** {@code SERVER / CLEAR / RAIN}；其他值視為 SERVER。 */
    String weather(UUID player);
}
```

### `SettingsHook.java`（使用端：偏好來源實作）

```java
package com.example.effects;

import com.example.settings.api.SettingsApi;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.UUID;
import java.util.logging.Level;

/** 從 Settings 插件取偏好；不可用或版本不合時回 {@link EffectPrefs#NONE}，功能降級而不是崩潰。 */
public final class SettingsHook implements EffectPreferences {

    private static final String PLUGIN_NAME = "Settings";

    private final JavaPlugin plugin;
    private boolean warned;

    public SettingsHook(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public EffectPrefs prefsOf(UUID player) {
        if (!plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME)) return EffectPrefs.NONE;
        try {
            SettingsApi api = plugin.getServer().getServicesManager().load(SettingsApi.class);
            if (api == null) return EffectPrefs.NONE;
            return new EffectPrefs(
                api.lowHealthBorder(player),
                api.nightVision(player),
                parse(EffectPrefs.TimePreset.class, api.time(player), EffectPrefs.TimePreset.SERVER),
                parse(EffectPrefs.WeatherPreset.class, api.weather(player), EffectPrefs.WeatherPreset.SERVER));
        } catch (LinkageError e) {
            if (!warned) {
                warned = true;
                plugin.getLogger().log(Level.WARNING,
                    PLUGIN_NAME + " API version mismatch; effects fall back to defaults.", e);
            }
            return EffectPrefs.NONE;
        }
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String name, E fallback) {
        if (name == null) return fallback;
        try {
            return Enum.valueOf(type, name);
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }
}
```

### `EffectsPlugin.java`（組裝）

```java
package com.example.effects;

import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

public final class EffectsPlugin extends JavaPlugin {

    private static final long SCAN_PERIOD_TICKS = 4L;
    private static final double LOW_HEALTH_THRESHOLD = 8.0;

    private EffectState state;
    private PlayerVisibilityService visibility;

    @Override
    public void onEnable() {
        state = new EffectState(getServer(), new SettingsHook(this),
            new LowHealthBorderEffect(getServer(), LOW_HEALTH_THRESHOLD),
            new PersonalTimeWeatherEffect(), new NightVisionEffect());
        visibility = new PlayerVisibilityService(this, this::hideFromViewer);

        getServer().getPluginManager().registerEvents(new EffectListener(this, state, visibility), this);
        getServer().getScheduler().runTaskTimer(this, state::tick, SCAN_PERIOD_TICKS, SCAN_PERIOD_TICKS);

        // /reload 或熱載入後，既有玩家也要套用
        for (Player player : getServer().getOnlinePlayers()) {
            state.refresh(player);
        }
        visibility.refreshAll();
    }

    @Override
    public void onDisable() {
        if (state != null) state.restoreAll();
        if (visibility != null) visibility.showAll();
    }

    /** 範例規則：不在同一個世界的人互相看不到。換成你的大廳／好友規則。 */
    private boolean hideFromViewer(Player viewer, Player target) {
        return !viewer.getWorld().equals(target.getWorld());
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/effects/
├── EffectsPlugin.java
├── EffectPrefs.java
├── EffectPreferences.java
├── BorderTint.java                    ← 純函式，可單元測試
├── EffectState.java                   ← 中央狀態 + reconcile()
├── EffectListener.java                ← 事件 → 下一 tick reconcile
├── LowHealthBorderEffect.java
├── PersonalTimeWeatherEffect.java
├── NightVisionEffect.java
├── PlayerVisibilityService.java
└── SettingsHook.java                  ← compileOnly 依賴 Settings 的 api package
```

## 執行緒安全注意事項 / Thread Safety

- 所有方法**只在主執行緒**呼叫：`Player#setWorldBorder`、`addPotionEffect`、`hidePlayer` 都碰到實體與追蹤狀態
- `EffectState`、`LowHealthBorderEffect`、`PlayerVisibilityService` 內的 `HashMap` 不是執行緒安全的，原因同上：不要從非同步執行緒碰
- 偏好來源（`EffectPreferences`）必須讀記憶體快取；資料庫載入完成後才呼叫 `refresh`，載入在非同步、套用回主執行緒（見 [`Skills/_shared/paper-threading.md`](../../_shared/paper-threading.md)）
- 事件裡用 `runTask` 排到下一 tick 後，**重新用 UUID 取 `Player`**，因為玩家可能已離線

## 失敗回退 / Fallback

| 現象 | 原因 | 解法 |
|------|------|------|
| 紅框一直留著 | 停用／換世界／關閉偏好時沒 `setWorldBorder(null)` | `clear` 在三個路徑都要呼叫；`onDisable` 用 `clearAll` |
| 真邊界縮小後紅框位置不對 | 虛擬邊界是舊的複本 | 聽 `WorldBorderBoundsChangeEvent`／`FinishEvent`／`CenterChangeEvent`，下一 tick 重抄；定時掃描兜底 |
| 換世界後紅框畫在舊世界座標 | 沒清掉舊世界的虛擬邊界 | `PlayerChangedWorldEvent` 先 `clear` 再重算 |
| 血量被 `setHealth` 改掉後紅框沒更新 | 該路徑不發事件 | 用定時掃描（本技能 4 tick）而不是聽傷害事件 |
| 喝牛奶／`/effect clear`／死亡後夜視消失 | 沒有重新套用 | `EntityPotionEffectEvent` → 下一 tick `reconcile()` |
| 開啟偏好後夜視只撐到舊藥水到期 | 用「有沒有夜視」判斷，被有限藥水騙過 | 判斷 `effect.isInfinite()` |
| 新加入的玩家看得到本該被隱藏的人 | 只處理了既有觀看者 | `joined()` 兩個方向都重算 |
| 隱藏的玩家重登後一直是隱形 | 登出前沒 `showPlayer` | `quit()` 先放出來再丟紀錄 |
| 被藏的玩家從 TAB 名單消失 | `hidePlayer` 的 Bukkit 行為 | 接受此行為，或改由 TAB 插件控制 |
| 事件裡直接加效果沒生效／無限遞迴 | 事件當下狀態未落定、自己觸發自己 | 一律 `runTask` 後再 `reconcile`，並略過自己套上去的無限效果 |
| `NoClassDefFoundError: SettingsApi` | Settings 未安裝且 API 型別出現在欄位／簽名 | API 型別只放方法本體的 `try` 內（見 `paper-service-api`） |
| 需要影響整個畫面以外的東西（假方塊、假實體） | Paper API 做不到 | 才改用 `nms-packet-sender` |
