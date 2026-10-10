---
name: paper-client-side-effects
description: "只用 Paper API 做每位玩家各自看到的錯覺：虛擬世界邊界紅框、個人時間／天氣、hidePlayer 可見性、夜視並在事件後重新套用 / Per-player illusions with Paper API only: virtual world border vignette, personal time/weather, hidePlayer visibility, night vision with reconcile-after-event"
---

# Paper Client-Side Effects

## Skill Name

`paper-client-side-effects`

## Purpose

When you need an effect that "only one player can see" (low-health vignette, personal time/weather, hiding other players in the lobby, passive night vision), **use the Paper API first, then consider packets or NMS**. All of these effects have ready-made methods and do not need `nms-packet-sender`:

| Effect | API | How to clear |
|------|-----|----------|
| Red vignette | `Server#createWorldBorder` + `Player#setWorldBorder` | `setWorldBorder(null)` |
| Personal time | `Player#setPlayerTime(long, boolean)` | `resetPlayerTime()` |
| Personal weather | `Player#setPlayerWeather(WeatherType)` | `resetPlayerWeather()` |
| Hide player | `Player#hidePlayer(Plugin, Player)` | `showPlayer(Plugin, Player)` |
| Night vision | `addPotionEffect` with infinite duration | Reapply with `reconcile()` after events |

The common root of these bugs is "**the effect is silently removed or replaced by something else after being applied**": the real border changed, the player changed worlds, died and respawned, drank milk, or `/effect clear` was run. The fix is to keep the "desired state" in a central `EffectState` and call `reconcile()` after every triggering event to reapply it, instead of patching each event separately.

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (the methods and events used here have identical signatures in both versions; both are compile-verified)
- Pure Paper API; no Paperweight, ProtocolLib, or PacketEvents needed

## Triggers

- 「虛擬世界邊界」「紅色邊框」「低血量紅框」「virtual world border」「warning distance」
- 「個人時間」「個人天氣」「setPlayerTime」「setPlayerWeather」
- 「隱藏玩家」「hidePlayer」「大廳顯示玩家」「per-viewer visibility」
- 「夜視被牛奶清掉」「EntityPotionEffectEvent」「重新套用效果」「restore effect」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `base_package` | `com.example.effects` | Output package |
| `low_health_threshold` | `8.0` | Health below which the vignette starts (half a heart is 1) |
| `effects` | `border, time, weather, night-vision, visibility` | Which effects are needed |
| `preference_source` | `SettingsApi` (see `paper-service-api`) | Where player preferences come from |
| `visibility_rule` | Hide non-friends only in the lobby | Decides "who cannot see whom" |

## Outputs

- `EffectPrefs.java` — a single player's preferences (immutable record + enum)
- `EffectPreferences.java` — preference source interface
- `BorderTint.java` — pure calculation of vignette intensity and warning distance
- `LowHealthBorderEffect.java` — apply/clear the virtual border
- `PersonalTimeWeatherEffect.java` — personal time and weather
- `NightVisionEffect.java` — infinite night vision
- `EffectState.java` — central state and `reconcile()`
- `EffectListener.java` — events that trigger `reconcile()`
- `PlayerVisibilityService.java` — plugin-scoped `hidePlayer`
- `SettingsApi.java` / `SettingsHook.java` — preference source hook (see `paper-service-api`)
- `EffectsPlugin.java` — assembly

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). Only `paper-api` is needed:

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
}
```

## Code Template

### `EffectPrefs.java`(preferences, immutable)

```java
package com.example.effects;

/** The effects a single player wants. Immutable: changing a preference produces a new record. */
public record EffectPrefs(
    boolean lowHealthBorder,
    boolean nightVision,
    TimePreset time,
    WeatherPreset weather
) {

    /** No preferences (everything off, time and weather follow the server). */
    public static final EffectPrefs NONE =
        new EffectPrefs(false, false, TimePreset.SERVER, WeatherPreset.SERVER);

    /** Personal time. {@code relative=false} fixes the time at that moment; {@code true} is an offset relative to server time (still flows). */
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

### `EffectPreferences.java`(preference source)

```java
package com.example.effects;

import java.util.UUID;

/**
 * Source of player preferences. Implementations may only read an in-memory cache (called on the main thread)
 * and must not do IO here; return {@link EffectPrefs#NONE} when nothing is available.
 */
@FunctionalInterface
public interface EffectPreferences {

    EffectPrefs prefsOf(UUID player);
}
```

### `BorderTint.java`(vignette calculation, pure functions)

```java
package com.example.effects;

/**
 * How the vignette is calculated. The client draws the red vignette when "distance to border &lt; warning distance",
 * with an intensity of about 1 - distance / warningDistance, so setting the warning distance to
 * "distance / (1 - desired intensity)" controls how strong it looks. No Bukkit dependency; directly unit-testable.
 */
public final class BorderTint {

    private static final double[] INTENSITY = {0.0, 0.25, 0.5, 0.75};
    private static final int MAX_WARNING_DISTANCE = 29_999_984;
    private static final int RESEND_THRESHOLD = 2;

    private BorderTint() {}

    /** What was last sent (or what we want to send this time); {@link #NONE} means the player sees the real border. */
    public record Sent(int level, int warningDistance, double size, double centerX, double centerZ) {
        public static final Sent NONE = new Sent(0, 0, 0.0, 0.0, 0.0);
    }

    /** 0 = hidden; 1..3 = deeper as health gets lower. */
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

    /** Resend only when the level, border size/center changed, or the warning distance differs noticeably, so not every scan sends a packet. */
    public static boolean needsResend(Sent last, Sent target) {
        return last.level() != target.level()
            || Double.compare(last.size(), target.size()) != 0
            || Double.compare(last.centerX(), target.centerX()) != 0
            || Double.compare(last.centerZ(), target.centerZ()) != 0
            || Math.abs(last.warningDistance() - target.warningDistance()) >= RESEND_THRESHOLD;
    }
}
```

### `LowHealthBorderEffect.java`(virtual border)

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
 * Low-health vignette. The virtual border copies the center and size of the real border in the player's world
 * and only changes the warning distance, so the real server-side border is still what blocks players;
 * the virtual border only affects the screen.
 *
 * <p>Not in {@link #sent} = the player sees the real border. Touch only on the main thread.
 */
public final class LowHealthBorderEffect {

    private final Server server;
    private final double threshold;
    private final Map<UUID, BorderTint.Sent> sent = new HashMap<>();

    public LowHealthBorderEffect(Server server, double threshold) {
        this.server = server;
        this.threshold = threshold;
    }

    /** Idempotent: may be called from the timer and any reconcile; only actually sends when the content changed. */
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

    /** Switches back to the real border. Always call this first when changing worlds: the current virtual border was copied from the old world. */
    public void clear(Player player) {
        player.setWorldBorder(null);
        sent.remove(player.getUniqueId());
    }

    /** Only forgets the record (used on player quit; the virtual border is not saved). */
    public void forget(UUID player) {
        sent.remove(player);
    }

    /** On disable, switches everyone back to the real border; otherwise the vignette stays until their next world change or relog. */
    public void clearAll() {
        for (UUID id : Map.copyOf(sent).keySet()) {
            Player player = server.getPlayer(id);
            if (player != null) player.setWorldBorder(null);
        }
        sent.clear();
    }
}
```

### `PersonalTimeWeatherEffect.java`(personal time and weather)

```java
package com.example.effects;

import org.bukkit.WeatherType;
import org.bukkit.entity.Player;

/**
 * Personal time and weather. Both are fields on the player: they are not cleared by world changes or death,
 * and are gone on quit (not saved to playerdata). Still included in reconcile: other plugins may call reset,
 * and reapplying only costs one extra small packet.
 */
public final class PersonalTimeWeatherEffect {

    public void apply(Player player, EffectPrefs prefs) {
        EffectPrefs.TimePreset time = prefs.time();
        if (time == EffectPrefs.TimePreset.SERVER) {
            player.resetPlayerTime();
        } else {
            // relative=false: fixed at that moment; relative=true: offset relative to server time
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

### `NightVisionEffect.java`(passive night vision)

```java
package com.example.effects;

import org.bukkit.entity.Player;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

/** Infinite, ambient, no particles, no icon night vision: looks like a passive buff rather than a potion. */
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
     * Whether the player already has "our" infinite night vision -- not just any night vision.
     * Checking only for presence gives false positives: if the player drank a finite night vision potion while the
     * preference was off, then turned the preference on and we skipped because "night vision already present",
     * they would lose night vision as soon as the potion expires (EXPIRATION is not a removal reason we intercept).
     * Checking {@code isInfinite()} overwrites it with a permanent one immediately.
     */
    public boolean isActive(Player player) {
        PotionEffect effect = player.getPotionEffect(PotionEffectType.NIGHT_VISION);
        return effect != null && effect.isInfinite();
    }
}
```

### `EffectState.java`(central state and reconcile)

```java
package com.example.effects;

import org.bukkit.Server;
import org.bukkit.World;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * The single source of each player's "desired effects", plus {@link #reconcile}, which reapplies them to the player.
 * Every triggering event (join, world change, respawn, real border change, effect removed) does exactly one thing:
 * call reconcile, instead of patching each event separately. Touch only on the main thread; no static mutable state.
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

    /** Re-reads from the preference source and applies (call after login or a settings page toggle). */
    public void refresh(Player player) {
        desired.put(player.getUniqueId(), preferences.prefsOf(player.getUniqueId()));
        reconcile(player);
    }

    /** Reapplies the "desired state" to the player. Idempotent; may be called repeatedly. */
    public void reconcile(Player player) {
        if (!player.isOnline()) return;
        EffectPrefs prefs = desired.getOrDefault(player.getUniqueId(), EffectPrefs.NONE);
        border.apply(player, prefs.lowHealthBorder());
        timeWeather.apply(player, prefs);
        if (prefs.nightVision()) {
            nightVision.apply(player);
        } else if (nightVision.isActive(player)) {
            nightVision.remove(player); // Remove only our infinite night vision; leave finite potions given by others alone
        }
    }

    /** World change: clear the old world's virtual border first, then recalculate from the new world's real border. */
    public void worldChanged(Player player) {
        border.clear(player);
        reconcile(player);
    }

    /** A world's real border changed: every player's virtual border in that world must be re-copied. */
    public void realBorderChanged(World world) {
        for (Player player : world.getPlayers()) {
            border.clear(player);
            reconcile(player);
        }
    }

    /** Periodic scan: health changes have no event (setHealth fires none); only the border needs to be tracked. */
    public void tick() {
        for (Player player : server.getOnlinePlayers()) {
            EffectPrefs prefs = desired.getOrDefault(player.getUniqueId(), EffectPrefs.NONE);
            border.apply(player, prefs.lowHealthBorder());
        }
    }

    /** Whether this player currently wants night vision (for event filtering). */
    public boolean wantsNightVision(UUID player) {
        return desired.getOrDefault(player, EffectPrefs.NONE).nightVision();
    }

    public void forget(UUID player) {
        desired.remove(player);
        border.forget(player);
    }

    /** Disable: restore virtual borders, personal time/weather, and our night vision. */
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

### `EffectListener.java`(events that trigger reconcile)

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
 * Every event does exactly one thing: schedule a reconcile call for the "next tick".
 * Effects are not changed at event time: the state has not settled yet (the real border is not changed yet, the
 * potion is not removed yet, the player has not finished respawning), and adding the same effect directly inside
 * {@link EntityPotionEffectEvent} easily triggers itself.
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
            visibility.joined(player); // new player <-> existing players: recalculate in both directions
        });
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        visibility.quit(event.getPlayer()); // show first, then forget
        state.forget(event.getPlayer().getUniqueId());
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onWorldChange(PlayerChangedWorldEvent event) {
        Player player = event.getPlayer();
        later(() -> {
            state.worldChanged(player);
            visibility.refreshAll(); // the rule may depend on the world
        });
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onRespawn(PlayerRespawnEvent event) {
        Player player = event.getPlayer();
        later(() -> state.worldChanged(player)); // respawn may cross worlds; death also cleared all potion effects
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBorderBounds(WorldBorderBoundsChangeEvent event) {
        World world = event.getWorld();
        later(() -> state.realBorderChanged(world)); // still the old size at event time; wait for the next tick
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

    /** Milk, /effect clear, death, finite potion overwrite: any reason night vision disappears or becomes finite. */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPotionEffect(EntityPotionEffectEvent event) {
        if (!(event.getEntity() instanceof Player player)) return;
        if (!state.wantsNightVision(player.getUniqueId())) return;
        PotionEffectType modified = event.getModifiedType();
        boolean cleared = event.getAction() == EntityPotionEffectEvent.Action.CLEARED;
        if (!cleared && modified != PotionEffectType.NIGHT_VISION) return;
        PotionEffect incoming = event.getNewEffect();
        if (incoming != null && incoming.isInfinite()) return; // we just applied this ourselves
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

### `PlayerVisibilityService.java`(plugin-scoped player hiding)

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
 * Hides/shows other players for each viewer according to a rule, using {@code hidePlayer(plugin, target)}:
 * the hiding belongs to this plugin, so it does not override players hidden by other plugins and is not undone
 * by another plugin's showPlayer.
 *
 * <p>Note: {@code hidePlayer} also removes the player from the TAB list (Bukkit behavior). If the TAB list must be
 * kept, use the TAB plugin's own visibility or accept this side effect. {@link #hidden} is touched only on the main thread.
 */
public final class PlayerVisibilityService {

    /** Whether viewer should be unable to see target. */
    @FunctionalInterface
    public interface Policy {
        boolean shouldHide(Player viewer, Player target);
    }

    private final Plugin plugin;
    private final Policy policy;
    /** Viewer -> the players this plugin is hiding for them. */
    private final Map<UUID, Set<UUID>> hidden = new HashMap<>();

    public PlayerVisibilityService(Plugin plugin, Policy policy) {
        this.plugin = plugin;
        this.policy = policy;
    }

    /** Recalculates one viewer's view, touching only the players that changed. */
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
     * A new player joins: they may need to be hidden from existing viewers (recalculate existing viewers), and the
     * rule also decides whom they can see (recalculate them). Both directions are required; doing only one gives
     * "I cannot see them but they can see me".
     */
    public void joined(Player joined) {
        refresh(joined);
        for (Player viewer : plugin.getServer().getOnlinePlayers()) {
            if (!viewer.equals(joined)) refresh(viewer);
        }
    }

    /**
     * Quit: show them to every viewer first, then drop the record. Bukkit remembers hiding by UUID;
     * if we only show them after they go offline there is no Player object any more, and they stay hidden after relogging.
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

    /** Disable: show everyone, otherwise hidden players only come back after relogging. */
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

### `SettingsApi.java`(the Settings plugin's api, JDK types only)

```java
package com.example.settings.api;

import java.util.UUID;

/** Preference queries provided by the Settings plugin (read-only in-memory cache, called on the main thread). See {@code paper-service-api}. */
public interface SettingsApi {

    boolean lowHealthBorder(UUID player);

    boolean nightVision(UUID player);

    /** {@code SERVER / DAWN / NOON / DUSK / MIDNIGHT / AHEAD_6H}; other values are treated as SERVER. */
    String time(UUID player);

    /** {@code SERVER / CLEAR / RAIN}; other values are treated as SERVER. */
    String weather(UUID player);
}
```

### `SettingsHook.java`(consumer side: preference source implementation)

```java
package com.example.effects;

import com.example.settings.api.SettingsApi;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.UUID;
import java.util.logging.Level;

/** Gets preferences from the Settings plugin; returns {@link EffectPrefs#NONE} when unavailable or the version does not match, degrading instead of crashing. */
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

### `EffectsPlugin.java`(assembly)

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

        // After /reload or hot loading, existing players must be applied too
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

    /** Example rule: players in different worlds cannot see each other. Replace with your lobby/friends rule. */
    private boolean hideFromViewer(Player viewer, Player target) {
        return !viewer.getWorld().equals(target.getWorld());
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/effects/
├── EffectsPlugin.java
├── EffectPrefs.java
├── EffectPreferences.java
├── BorderTint.java                    <- pure functions, unit-testable
├── EffectState.java                   <- central state + reconcile()
├── EffectListener.java                <- event -> reconcile on the next tick
├── LowHealthBorderEffect.java
├── PersonalTimeWeatherEffect.java
├── NightVisionEffect.java
├── PlayerVisibilityService.java
└── SettingsHook.java                  <- compileOnly dependency on the Settings api package
```

## Thread Safety

- Call all methods **on the main thread only**: `Player#setWorldBorder`, `addPotionEffect`, and `hidePlayer` all touch entities and tracking state
- The `HashMap`s inside `EffectState`, `LowHealthBorderEffect`, and `PlayerVisibilityService` are not thread-safe, for the same reason: do not touch them from async threads
- The preference source (`EffectPreferences`) must read an in-memory cache; call `refresh` only after the database load finishes, load async and apply back on the main thread (see [`references/paper-threading.md`](references/paper-threading.md))
- After scheduling to the next tick with `runTask` inside an event, **look up the `Player` again by UUID**, because the player may have gone offline

## Fallback

| Symptom | Cause | Solution |
|------|------|------|
| Vignette stays forever | `setWorldBorder(null)` not called on disable / world change / preference off | Call `clear` on all three paths; use `clearAll` in `onDisable` |
| Vignette position wrong after the real border shrinks | The virtual border is a stale copy | Listen to `WorldBorderBoundsChangeEvent`/`FinishEvent`/`CenterChangeEvent` and re-copy on the next tick; the periodic scan is the safety net |
| Vignette drawn at old-world coordinates after a world change | The old world's virtual border was not cleared | In `PlayerChangedWorldEvent`, `clear` first and then recalculate |
| Vignette not updated after health is changed by `setHealth` | That path fires no event | Use a periodic scan (4 ticks in this skill) instead of listening to damage events |
| Night vision gone after milk / `/effect clear` / death | Not reapplied | `EntityPotionEffectEvent` -> `reconcile()` on the next tick |
| After enabling the preference, night vision only lasts until the old potion expires | Checked "has night vision" and was fooled by a finite potion | Check `effect.isInfinite()` |
| A newly joined player can see players who should be hidden | Only existing viewers were handled | `joined()` recalculates in both directions |
| A hidden player stays invisible after relogging | `showPlayer` not called before quit | `quit()` shows them first, then drops the record |
| A hidden player disappears from the TAB list | Bukkit behavior of `hidePlayer` | Accept this behavior, or let a TAB plugin control it |
| Adding an effect directly in an event has no effect / recurses infinitely | State not settled at event time; triggers itself | Always `reconcile` after `runTask`, and skip the infinite effect we applied ourselves |
| `NoClassDefFoundError: SettingsApi` | Settings is not installed and the API type appears in a field/signature | Keep API types only inside a method body `try` (see `paper-service-api`) |
| Need something beyond screen-wide effects (fake blocks, fake entities) | The Paper API cannot do it | Only then switch to `nms-packet-sender` |
