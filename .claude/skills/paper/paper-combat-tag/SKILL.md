---
name: paper-combat-tag
description: "PvP 戰鬥標記：純邏輯 CombatTagService（UUID + 時間戳、可 JUnit）、傷害歸因矩陣（近戰/射擊物/藥水/TNT/水晶/重生錨/狼）、指令白名單、傳送封鎖、戰鬥登出判死，並以 ServicesManager 公開 CombatTagApi / PvP combat tagging with a Bukkit-free core service, damage attribution matrix, command whitelist, teleport block, combat-logout punishment and a ServicesManager API"
---

# Paper Combat Tag

## Skill Name

`paper-combat-tag`

## Purpose

After players fight, they enter a "combat state" for a while: escape methods (commands, plugin teleports, logging out) are forbidden, and logging out counts as death. The key is attributing **who hit whom** correctly, because damage often is not dealt by a player directly.

The architecture has two layers:

- **Core (`core` package)**: `CombatTagService`, `CommandPolicy`, `KickRule`, `TeleportRule`, `ActionLedger`. Uses only `UUID`, `long` millisecond timestamps and strings, does not import `org.bukkit`, and can be tested directly with JUnit, no MockBukkit needed.
- **Adapter layer (`adapter` package)**: Listeners translate Bukkit events into core inputs, and translate core verdicts into event cancellations, messages and executions.

Other plugins obtain `CombatTagApi` through `ServicesManager` (see [`paper-service-api`](../paper-service-api/SKILL.md) for how).

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (identical on both; uses `DamageSource`, `PlayerKickEvent.Cause`, `PotionEffectTypeCategory`)
- Pure Paper API, no Paperweight needed

## Triggers

- 「戰鬥標記」「combat tag」「combat log」「戰鬥中登出」「PvP 逃跑」
- 「戰鬥中禁止指令」「戰鬥中禁止傳送」「傷害來源判斷」「damage attribution」
- 「射擊物／藥水／TNT／水晶 傷害算誰的」「CombatTagApi」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `base_package` | `com.example.combat` | Root package; core is in `.core`, API in `.api` (**the API must not be relocated**) |
| `duration_seconds` | `20` | Tag duration in seconds, reset on every hit taken or dealt |
| `command_whitelist` | `msg`, `r`, `tell` | Commands still usable in combat (use the **canonical command name**; aliases are normalized automatically) |
| `logout_mode` | `KILL` / `DROP_ITEMS` | Punishment for logging out in combat |
| `blocked_teleport_causes` | `COMMAND`, `PLUGIN` | `TeleportCause` values to cancel in combat (pearls, chorus fruit and portals are allowed by default) |
| `bypass_permission` | `combattag.bypass` | Holders are not tagged |

## Outputs

- Core: `CombatTagService`, `ActionLedger`, `CommandPolicy`, `KickRule`, `TeleportRule`
- Config: `CombatConfig` (immutable record), `config.yml`
- Adapter layer: `AttackerResolver`, `CombatTagger`, `DamageListener`, `PotionListener`, `BombListener`, `CommandListener`, `TeleportListener`, `KickListener`, `QuitListener`, `DeathListener`, `CombatTicker`
- Public API: `CombatTagApi` (`api` package), `CombatTagApiImpl`
- `CombatTagPlugin` (assembly and registration), `plugin.yml`

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). Tests use JUnit (the core contains no Bukkit, so MockBukkit is not needed):

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable' // 1.21.11: '1.21.11-R0.1-SNAPSHOT'
    testImplementation 'org.junit.jupiter:junit-jupiter:5.11.4'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

test {
    useJUnitPlatform()
}
```

## Damage Attribution Matrix

| Damage source | How to determine | Notes |
|----------|----------|------|
| Melee | `DamageSource#getCausingEntity()` is a `Player` | Most common |
| Arrows, tridents, snowballs, fishing rods | `Projectile#getShooter()` is a `Player` | `getCausingEntity` is usually already the shooter; use `getDirectEntity` as a fallback |
| Splash / lingering potions | `PotionSplashEvent`: `ThrownPotion#getShooter()` + harmful effect + `getIntensity > 0` | Effects without a damage number, such as poison and wither, do not trigger `EntityDamageEvent` |
| Potion clouds | `AreaEffectCloudApplyEvent`: `AreaEffectCloud#getSource()` | The cloud left after a lingering potion lands |
| TNT | `TNTPrimed#getSource()` (the igniter) | Chain detonations also keep the igniter |
| End crystals | Record when the crystal is hit; look it up within a short window when it explodes | The crystal itself has no "who hit it" field |
| Respawn anchors / beds | Record on right-click (`ActionLedger`); on `BLOCK_EXPLOSION` look up with `getDamageLocation()` | The explosion and the click are in the same tick; window of 1-2 ticks |
| Tamed wolves, etc. | `Tameable#getOwnerUniqueId()` (counts only if the owner is online) | |
| Fire, fall, void (after being hit) | **Do not reset the tag** and do not create a new one | Prevents burning from extending combat indefinitely; use `lastAttacker` for death attribution |
| Self-damage, cancelled events | Ignore | `EventPriority.MONITOR` + `ignoreCancelled = true` |

## Code Template

### `CombatTagService.java` (core, no Bukkit)

```java
package com.example.combat.core;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
     * Combat tag state. Uses only UUIDs and millisecond timestamps; the caller passes in the time, so tests do not wait for real time.
     * Not thread-safe: use on the main thread only.
 */
public final class CombatTagService {

    /** Punishment verdict on logout. */
    public enum LogoutVerdict { NONE, PUNISH }

    private record Tag(long expiresAtMillis, UUID lastAttacker) {
    }

    private final long durationMillis;
    private final Map<UUID, Tag> tags = new HashMap<>();
    private final Set<UUID> exemptLogouts = new HashSet<>();

    public CombatTagService(long durationMillis) {
        if (durationMillis <= 0) {
            throw new IllegalArgumentException("durationMillis must be positive: " + durationMillis);
        }
        this.durationMillis = durationMillis;
    }

    /**
     * One PvP interaction. Self-damage does not count; a bypass player is not tagged but still tags the opponent.
     *
     * @return the players who just entered combat this time (had no tag before); used to send the entry message only once
     */
    public Set<UUID> hit(UUID victim, UUID attacker, long now, boolean victimBypass, boolean attackerBypass) {
        Objects.requireNonNull(victim, "victim");
        Objects.requireNonNull(attacker, "attacker");
        if (victim.equals(attacker)) {
            return Set.of();
        }
        long expiresAt = now + durationMillis;
        Set<UUID> entered = new HashSet<>();
        if (!victimBypass) {
            if (!isTagged(victim, now)) {
                entered.add(victim);
            }
            tags.put(victim, new Tag(expiresAt, attacker));
        }
        if (!attackerBypass) {
            if (!isTagged(attacker, now)) {
                entered.add(attacker);
            }
            tags.put(attacker, new Tag(expiresAt, victim));
        }
        return Set.copyOf(entered);
    }

    public boolean isTagged(UUID player, long now) {
        Tag tag = tags.get(player);
        return tag != null && tag.expiresAtMillis() > now;
    }

    /** Remaining seconds, rounded up; 0 if not tagged or already expired. */
    public long remainingSeconds(UUID player, long now) {
        Tag tag = tags.get(player);
        if (tag == null || tag.expiresAtMillis() <= now) {
            return 0;
        }
        return (tag.expiresAtMillis() - now + 999) / 1000;
    }

    /** The last opponent; empty if the tag has expired. */
    public Optional<UUID> lastAttacker(UUID player, long now) {
        Tag tag = tags.get(player);
        if (tag == null || tag.expiresAtMillis() <= now) {
            return Optional.empty();
        }
        return Optional.of(tag.lastAttacker());
    }

    /** Remove the tag (death, API). Returns false if there was no tag. */
    public boolean untag(UUID player) {
        return tags.remove(player) != null;
    }

    /** Remove and return the players whose tags have expired; the ticker calls this once per second to send "left combat". */
    public Set<UUID> expire(long now) {
        Set<UUID> expired = new HashSet<>();
        tags.entrySet().removeIf(entry -> {
            boolean done = entry.getValue().expiresAtMillis() <= now;
            if (done) {
                expired.add(entry.getKey());
            }
            return done;
        });
        return Set.copyOf(expired);
    }

    /** All players that currently have a record (snapshot). */
    public Set<UUID> tagged() {
        return Set.copyOf(tags.keySet());
    }

    /** Record whether this kick is an admin action (see {@link KickRule}); {@code PlayerKickEvent} fires before quit. */
    public void markKicked(UUID player, boolean exemptFromPunishment) {
        if (exemptFromPunishment) {
            exemptLogouts.add(player);
        } else {
            exemptLogouts.remove(player);
        }
    }

    /** Call on logout: returns the punishment verdict and clears all of the player's state. */
    public LogoutVerdict onQuit(UUID player, long now) {
        boolean exempt = exemptLogouts.remove(player);
        boolean wasTagged = isTagged(player, now);
        tags.remove(player);
        return wasTagged && !exempt ? LogoutVerdict.PUNISH : LogoutVerdict.NONE;
    }

    /** Clear on disable or reload. */
    public void clear() {
        tags.clear();
        exemptLogouts.clear();
    }
}
```

### `ActionLedger.java` (core: short-window attribution table)

```java
package com.example.combat.core;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * "Who did what to which thing in which tick". A respawn anchor / bed click or an end crystal being hit happens in the same tick (or an adjacent tick) as the resulting explosion damage,
 * and the explosion damage itself has no reliable causing entity, so this table is used to look it up within a short window.
 * Immutable: each record returns a new copy and drops expired entries along the way, so the table only ever holds a few entries.
 */
public record ActionLedger(Map<String, Entry> entries) {

    public record Entry(UUID player, int tick) {
    }

    public ActionLedger {
        entries = Map.copyOf(entries);
    }

    public static ActionLedger empty() {
        return new ActionLedger(Map.of());
    }

    public ActionLedger record(String key, UUID player, int tick, int windowTicks) {
        Map<String, Entry> next = new HashMap<>();
        for (Map.Entry<String, Entry> e : entries.entrySet()) {
            if (tick - e.getValue().tick() <= windowTicks) {
                next.put(e.getKey(), e.getValue());
            }
        }
        next.put(key, new Entry(player, tick));
        return new ActionLedger(next);
    }

    public Optional<UUID> lookup(String key, int tick, int windowTicks) {
        Entry entry = entries.get(key);
        if (entry == null || tick - entry.tick() > windowTicks) {
            return Optional.empty();
        }
        return Optional.of(entry.player());
    }

    public static String blockKey(String world, int x, int y, int z) {
        return "block:" + world + ":" + x + ":" + y + ":" + z;
    }

    public static String entityKey(UUID entity) {
        return "entity:" + entity;
    }
}
```

### `CommandPolicy.java` (core: command whitelist)

```java
package com.example.combat.core;

import java.util.Locale;
import java.util.Set;

/**
 * Command whitelist during combat.
 *
 * <p>Flow: the Listener first extracts the command word the player typed with {@link #rawToken} and hands it to {@code CommandMap} to resolve to the canonical command name
 * (the alias {@code /t} and the namespace form {@code /minecraft:tell} both end up as {@code tell}), then compares with {@link #allowed}.
 * When it cannot be resolved (unknown command), fall back to {@link #stripNamespace}. The whitelist is normalized with {@link #normalize} when the config is loaded.
 */
public final class CommandPolicy {

    private CommandPolicy() {
    }

    /** Strip leading whitespace and {@code /}, take up to the first whitespace, lower-case; the namespace is kept. */
    public static String rawToken(String commandLine) {
        String s = commandLine.strip();
        if (s.startsWith("/")) {
            s = s.substring(1);
        }
        int end = 0;
        while (end < s.length() && !Character.isWhitespace(s.charAt(end))) {
            end++;
        }
        return s.substring(0, end).toLowerCase(Locale.ROOT);
    }

    /** {@code minecraft:tp} -> {@code tp}. */
    public static String stripNamespace(String token) {
        int colon = token.lastIndexOf(':');
        return colon < 0 ? token : token.substring(colon + 1);
    }

    /** Config spelling ({@code /Msg}, {@code  msg }) -> {@code msg}. */
    public static String normalize(String configured) {
        return stripNamespace(rawToken(configured));
    }

    public static boolean allowed(String commandName, Set<String> whitelist) {
        return !commandName.isEmpty() && whitelist.contains(commandName);
    }
}
```

### `KickRule.java` (core: kick reasons that are exempt from death)

```java
package com.example.combat.core;

import java.util.Set;

/**
 * Which kick reasons count as an "admin / server action": a tagged player kicked for these reasons is not punished.
 * The rest (second client login, packet violations, timeout, idle, kicks by other plugins) are escape methods a player can trigger themselves, and are still punished.
 *
 * <p>The parameter is {@code PlayerKickEvent.Cause#name()}; the core does not import Bukkit.
 * Do not look at {@code PlayerQuitEvent#getReason()}: it also returns {@code KICKED} for the escape methods above.
 */
public final class KickRule {

    public static final Set<String> EXEMPT_CAUSES = Set.of(
        "KICK_COMMAND", "BANNED", "IP_BANNED", "WHITELIST", "RESTART_COMMAND");

    private KickRule() {
    }

    public static boolean exemptsPunishment(String causeName) {
        return EXEMPT_CAUSES.contains(causeName);
    }
}
```

### `TeleportRule.java` (core: teleport causes)

```java
package com.example.combat.core;

import java.util.Set;

/**
 * Which teleports to cancel during combat. By default only {@code COMMAND} and {@code PLUGIN} are blocked (those are escapes);
 * ender pearls, chorus fruit and portals are vanilla combat tools and are allowed. Takes the {@code cause.name()} string so tests need not import Bukkit.
 */
public final class TeleportRule {

    public static final Set<String> DEFAULT_BLOCKED = Set.of("COMMAND", "PLUGIN");

    private TeleportRule() {
    }

    public static boolean blocks(String causeName, Set<String> blocked) {
        return causeName != null && blocked.contains(causeName);
    }
}
```

### `CombatConfig.java` (immutable config)

```java
package com.example.combat.adapter;

import com.example.combat.core.CommandPolicy;
import com.example.combat.core.TeleportRule;
import org.bukkit.configuration.ConfigurationSection;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Immutable config parsed once at startup; Listeners do not read getConfig() directly. */
public record CombatConfig(
    long durationMillis,
    Set<String> commandWhitelist,
    LogoutMode logoutMode,
    Set<String> blockedTeleportCauses,
    int attributionWindowTicks
) {

    public enum LogoutMode { KILL, DROP_ITEMS }

    public static final String BYPASS_PERMISSION = "combattag.bypass";

    public CombatConfig {
        commandWhitelist = Set.copyOf(commandWhitelist);
        blockedTeleportCauses = Set.copyOf(blockedTeleportCauses);
    }

    /** A config error throws {@link IllegalArgumentException} directly (fail fast at startup; onEnable disables the plugin). */
    public static CombatConfig from(ConfigurationSection section) {
        int seconds = section.getInt("duration-seconds", 20);
        if (seconds < 1) {
            throw new IllegalArgumentException("duration-seconds must be >= 1: " + seconds);
        }
        Set<String> whitelist = new HashSet<>();
        for (String raw : section.getStringList("command-whitelist")) {
            String name = CommandPolicy.normalize(raw);
            if (!name.isEmpty()) {
                whitelist.add(name);
            }
        }
        LogoutMode mode;
        try {
            mode = LogoutMode.valueOf(section.getString("logout-mode", "KILL").toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("logout-mode must be KILL or DROP_ITEMS", e);
        }
        List<String> causes = section.getStringList("blocked-teleport-causes");
        Set<String> blocked = causes.isEmpty() ? TeleportRule.DEFAULT_BLOCKED : new HashSet<>(causes);
        int window = Math.max(1, section.getInt("attribution-window-ticks", 2));
        return new CombatConfig(seconds * 1000L, whitelist, mode, blocked, window);
    }
}
```

### `CombatMessages.java` (MiniMessage messages)

```java
package com.example.combat.adapter;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;

/** Player-visible text is centralized here (English, MiniMessage); values always go through unparsed placeholders to avoid tag injection. */
final class CombatMessages {

    private static final MiniMessage MM = MiniMessage.miniMessage();

    private CombatMessages() {
    }

    static Component entered(long seconds) {
        return MM.deserialize("<red>You are in combat. Do not log out for <white><seconds></white> seconds.",
            Placeholder.unparsed("seconds", Long.toString(seconds)));
    }

    static Component countdown(long seconds) {
        return MM.deserialize("<red>In combat <white><seconds>s</white>",
            Placeholder.unparsed("seconds", Long.toString(seconds)));
    }

    static Component left() {
        return MM.deserialize("<green>You are no longer in combat.");
    }

    static Component commandBlocked() {
        return MM.deserialize("<red>You cannot use that command while in combat.");
    }

    static Component teleportBlocked() {
        return MM.deserialize("<red>You cannot teleport while in combat.");
    }
}
```

### `AttackerResolver.java` (adapter layer: attribution)

```java
package com.example.combat.adapter;

import com.example.combat.core.ActionLedger;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.damage.DamageSource;
import org.bukkit.entity.AreaEffectCloud;
import org.bukkit.entity.EnderCrystal;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.entity.Tameable;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.plugin.Plugin;
import org.bukkit.projectiles.ProjectileSource;

import java.util.Optional;
import java.util.UUID;

/**
 * Which player caused a given piece of damage. Use on the main thread only; {@code ledger} is replaced with a whole new immutable copy each time, so there is no shared mutable state.
 */
public final class AttackerResolver {

    private final Plugin plugin;
    private final int windowTicks;
    private ActionLedger ledger = ActionLedger.empty();

    public AttackerResolver(Plugin plugin, int windowTicks) {
        this.plugin = plugin;
        this.windowTicks = windowTicks;
    }

    /** Call when a respawn anchor / bed is right-clicked. */
    public void recordBlock(Block block, UUID player) {
        String key = ActionLedger.blockKey(block.getWorld().getName(), block.getX(), block.getY(), block.getZ());
        ledger = ledger.record(key, player, plugin.getServer().getCurrentTick(), windowTicks);
    }

    /** Call when a player hits an end crystal. */
    public void recordCrystal(EnderCrystal crystal, UUID player) {
        ledger = ledger.record(ActionLedger.entityKey(crystal.getUniqueId()), player,
            plugin.getServer().getCurrentTick(), windowTicks);
    }

    public Optional<UUID> resolve(EntityDamageEvent event) {
        DamageSource source = event.getDamageSource();
        Optional<UUID> found = fromEntity(source.getCausingEntity());
        if (found.isPresent()) {
            return found;
        }
        Entity directEntity = source.getDirectEntity();
        found = fromEntity(directEntity);
        if (found.isPresent()) {
            return found;
        }
        int tick = plugin.getServer().getCurrentTick();
        if (directEntity instanceof EnderCrystal crystal) {
            return ledger.lookup(ActionLedger.entityKey(crystal.getUniqueId()), tick, windowTicks);
        }
        if (directEntity == null && event.getCause() == EntityDamageEvent.DamageCause.BLOCK_EXPLOSION) {
            Location at = source.getDamageLocation();
            World world = at == null ? null : at.getWorld();
            if (at == null || world == null) {
                return Optional.empty();
            }
            String key = ActionLedger.blockKey(world.getName(), at.getBlockX(), at.getBlockY(), at.getBlockZ());
            return ledger.lookup(key, tick, windowTicks);
        }
        return Optional.empty();
    }

    /** The player themself, a projectile's shooter, a TNT igniter, a potion cloud's source, a tamed animal's online owner. */
    public Optional<UUID> fromEntity(Entity entity) {
        if (entity == null) {
            return Optional.empty();
        }
        if (entity instanceof Player player) {
            return Optional.of(player.getUniqueId());
        }
        if (entity instanceof Projectile projectile) {
            return fromShooter(projectile.getShooter());
        }
        if (entity instanceof TNTPrimed tnt) {
            return fromEntity(tnt.getSource());
        }
        if (entity instanceof AreaEffectCloud cloud) {
            return fromShooter(cloud.getSource());
        }
        if (entity instanceof Tameable pet) {
            UUID owner = pet.getOwnerUniqueId();
            if (owner != null && plugin.getServer().getPlayer(owner) != null) {
                return Optional.of(owner);
            }
        }
        return Optional.empty();
    }

    private Optional<UUID> fromShooter(ProjectileSource shooter) {
        return shooter instanceof Entity entity ? fromEntity(entity) : Optional.empty();
    }

    public void clear() {
        ledger = ActionLedger.empty();
    }
}
```

### `CombatTagger.java` (adapter layer: apply the tag)

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.Set;
import java.util.UUID;
import java.util.function.LongSupplier;

/** Shared entry point for Listeners: handles the bypass permission, offline opponents and the entered-combat message. */
public final class CombatTagger {

    private final Plugin plugin;
    private final CombatTagService service;
    private final LongSupplier clock;

    public CombatTagger(Plugin plugin, CombatTagService service, LongSupplier clock) {
        this.plugin = plugin;
        this.service = service;
        this.clock = clock;
    }

    /** Call on the main thread. attacker is offline (for example logged out after shooting an arrow) -> skip. */
    public void tag(Player victim, UUID attackerId) {
        Player attacker = plugin.getServer().getPlayer(attackerId);
        if (attacker == null) {
            return;
        }
        long now = clock.getAsLong();
        Set<UUID> entered = service.hit(
            victim.getUniqueId(), attackerId, now,
            victim.hasPermission(CombatConfig.BYPASS_PERMISSION),
            attacker.hasPermission(CombatConfig.BYPASS_PERMISSION));
        for (UUID id : entered) {
            Player player = plugin.getServer().getPlayer(id);
            if (player != null) {
                player.sendMessage(CombatMessages.entered(service.remainingSeconds(id, now)));
            }
        }
    }
}
```

### `DamageListener.java` (adapter layer: damage)

```java
package com.example.combat.adapter;

import org.bukkit.entity.EnderCrystal;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;

import java.util.UUID;

/**
 * MONITOR + ignoreCancelled: only look at damage that was actually dealt, and do not interfere with other plugins' cancel logic.
 * Environmental damage (fire, fall, void) has no player attribution -> resolve returns empty -> the tag is not reset.
 */
public final class DamageListener implements Listener {

    private final AttackerResolver resolver;
    private final CombatTagger tagger;

    public DamageListener(AttackerResolver resolver, CombatTagger tagger) {
        this.resolver = resolver;
        this.tagger = tagger;
    }

    /** Crystal hit: record first; the explosion damage arrives a bit later (same tick). */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCrystalHit(EntityDamageByEntityEvent event) {
        if (event.getEntity() instanceof EnderCrystal crystal) {
            resolver.fromEntity(event.getDamager()).ifPresent(id -> resolver.recordCrystal(crystal, id));
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent event) {
        if (!(event.getEntity() instanceof Player victim) || event.getFinalDamage() <= 0) {
            return;
        }
        UUID attacker = resolver.resolve(event).orElse(null);
        if (attacker != null) {
            tagger.tag(victim, attacker);
        }
    }
}
```

### `PotionListener.java` (adapter layer: potions and potion clouds)

```java
package com.example.combat.adapter;

import org.bukkit.entity.AreaEffectCloud;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.entity.ThrownPotion;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.AreaEffectCloudApplyEvent;
import org.bukkit.event.entity.PotionSplashEvent;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectTypeCategory;
import org.bukkit.potion.PotionType;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Splash / lingering potions and potion clouds. Effects such as poison, wither and slowness do not trigger EntityDamageEvent (or only on the next tick),
 * so tag at the moment the effect is applied; only harmful effects count, so throwing a healing potion at a teammate does not.
 */
public final class PotionListener implements Listener {

    private final AttackerResolver resolver;
    private final CombatTagger tagger;

    public PotionListener(AttackerResolver resolver, CombatTagger tagger) {
        this.resolver = resolver;
        this.tagger = tagger;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onSplash(PotionSplashEvent event) {
        ThrownPotion potion = event.getEntity();
        if (!hasHarmful(potion.getEffects())) {
            return;
        }
        resolver.fromEntity(potion).ifPresent(attacker -> {
            for (LivingEntity affected : event.getAffectedEntities()) {
                if (affected instanceof Player victim && event.getIntensity(affected) > 0) {
                    tagger.tag(victim, attacker);
                }
            }
        });
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCloud(AreaEffectCloudApplyEvent event) {
        AreaEffectCloud cloud = event.getEntity();
        List<PotionEffect> effects = new ArrayList<>(cloud.getCustomEffects());
        PotionType base = cloud.getBasePotionType();
        if (base != null) {
            effects.addAll(base.getPotionEffects());
        }
        if (!hasHarmful(effects)) {
            return;
        }
        resolver.fromEntity(cloud).ifPresent(attacker -> {
            for (LivingEntity affected : event.getAffectedEntities()) {
                if (affected instanceof Player victim) {
                    tagger.tag(victim, attacker);
                }
            }
        });
    }

    private static boolean hasHarmful(Collection<PotionEffect> effects) {
        for (PotionEffect effect : effects) {
            if (effect.getType().getCategory() == PotionEffectTypeCategory.HARMFUL) {
                return true;
            }
        }
        return false;
    }
}
```

### `BombListener.java` (adapter layer: respawn anchor / bed ledger)

```java
package com.example.combat.adapter;

import org.bukkit.Material;
import org.bukkit.Tag;
import org.bukkit.block.Block;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;

/**
 * Right-clicking a bed in a dimension where sleeping is impossible, or wrongly charging a respawn anchor, causes an explosion, and explosion damage has no causing entity.
 * This class only "records an entry"; whether it really explodes and hurts someone is looked up by {@link AttackerResolver} at damage-event time.
 * Normal sleeping is recorded too, but the window is only 1-2 ticks, so there is no false attribution.
 */
public final class BombListener implements Listener {

    private final AttackerResolver resolver;

    public BombListener(AttackerResolver resolver) {
        this.resolver = resolver;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onInteract(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK) {
            return;
        }
        Block block = event.getClickedBlock();
        if (block == null) {
            return;
        }
        Material type = block.getType();
        if (type == Material.RESPAWN_ANCHOR || Tag.BEDS.isTagged(type)) {
            resolver.recordBlock(block, event.getPlayer().getUniqueId());
        }
    }
}
```

### `CommandListener.java` (adapter layer: command whitelist)

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import com.example.combat.core.CommandPolicy;
import org.bukkit.command.Command;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.plugin.Plugin;

import java.util.Locale;
import java.util.function.LongSupplier;

/**
 * During combat only whitelisted commands pass. Before comparing, the CommandMap resolves aliases and namespaces ({@code /minecraft:tell}, {@code /t})
 * to the canonical command name; when it cannot be resolved (unknown command), fall back to the string with the namespace stripped.
 * LOWEST: block before other plugins handle it, so they have not already run their side effects.
 */
public final class CommandListener implements Listener {

    private final Plugin plugin;
    private final CombatTagService service;
    private final CombatConfig config;
    private final LongSupplier clock;

    public CommandListener(Plugin plugin, CombatTagService service, CombatConfig config, LongSupplier clock) {
        this.plugin = plugin;
        this.service = service;
        this.config = config;
        this.clock = clock;
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) {
        Player player = event.getPlayer();
        if (!service.isTagged(player.getUniqueId(), clock.getAsLong())) {
            return;
        }
        String raw = CommandPolicy.rawToken(event.getMessage());
        Command command = plugin.getServer().getCommandMap().getCommand(raw);
        String name = command != null
            ? command.getName().toLowerCase(Locale.ROOT)
            : CommandPolicy.stripNamespace(raw);
        if (!CommandPolicy.allowed(name, config.commandWhitelist())) {
            event.setCancelled(true);
            player.sendMessage(CombatMessages.commandBlocked());
        }
    }
}
```

### `TeleportListener.java` (adapter layer: teleport block)

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import com.example.combat.core.TeleportRule;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerTeleportEvent;

import java.util.function.LongSupplier;

/** Blocks only {@link CombatConfig#blockedTeleportCauses()} (by default command and plugin teleports); pearls, chorus fruit and portals are allowed. */
public final class TeleportListener implements Listener {

    private final CombatTagService service;
    private final CombatConfig config;
    private final LongSupplier clock;

    public TeleportListener(CombatTagService service, CombatConfig config, LongSupplier clock) {
        this.service = service;
        this.config = config;
        this.clock = clock;
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent event) {
        if (!TeleportRule.blocks(event.getCause().name(), config.blockedTeleportCauses())) {
            return;
        }
        Player player = event.getPlayer();
        if (service.isTagged(player.getUniqueId(), clock.getAsLong())) {
            event.setCancelled(true);
            player.sendMessage(CombatMessages.teleportBlocked());
        }
    }
}
```

### `KickListener.java` (adapter layer: kick reason)

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import com.example.combat.core.KickRule;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerKickEvent;

/** Whether a kick is exempt from death depends on the {@code PlayerKickEvent.Cause} whitelist (see {@link KickRule}); this event fires before PlayerQuitEvent. */
public final class KickListener implements Listener {

    private final CombatTagService service;

    public KickListener(CombatTagService service) {
        this.service = service;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onKick(PlayerKickEvent event) {
        service.markKicked(event.getPlayer().getUniqueId(), KickRule.exemptsPunishment(event.getCause().name()));
    }
}
```

### `QuitListener.java` (adapter layer: combat-logout punishment)

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.ItemStack;

import java.util.function.LongSupplier;

/**
 * Logging out in combat -> punishment. NORMAL priority: execute before other plugins' MONITOR cleanup so that their death-event handling still runs normally.
 * The {@code PlayerDeathEvent} after execution clears the tag again in {@link DeathListener} (already cleared by onQuit, harmless).
 */
public final class QuitListener implements Listener {

    private final CombatTagService service;
    private final CombatConfig config;
    private final LongSupplier clock;

    public QuitListener(CombatTagService service, CombatConfig config, LongSupplier clock) {
        this.service = service;
        this.config = config;
        this.clock = clock;
    }

    @EventHandler(priority = EventPriority.NORMAL)
    public void onQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        if (service.onQuit(player.getUniqueId(), clock.getAsLong()) != CombatTagService.LogoutVerdict.PUNISH) {
            return;
        }
        if (player.isDead()) {
            return;
        }
        switch (config.logoutMode()) {
            case KILL -> player.setHealth(0.0);
            case DROP_ITEMS -> dropInventory(player);
        }
    }

    private static void dropInventory(Player player) {
        Location at = player.getLocation();
        World world = at.getWorld();
        for (ItemStack item : player.getInventory().getContents()) {
            if (item != null && !item.getType().isAir()) {
                world.dropItemNaturally(at, item);
            }
        }
        player.getInventory().clear();
    }
}
```

### `DeathListener.java` (adapter layer: untag on death)

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;

/** Untag on death. {@code ignoreCancelled}: a death cancelled by another plugin does not count. */
public final class DeathListener implements Listener {

    private final CombatTagService service;

    public DeathListener(CombatTagService service) {
        this.service = service;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDeath(PlayerDeathEvent event) {
        service.untag(event.getPlayer().getUniqueId());
    }
}
```

### `CombatTicker.java` (adapter layer: one timer per second)

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.UUID;
import java.util.function.LongSupplier;
import java.util.logging.Level;

/**
 * The only per-second timer on the whole server: updates the action bar for every tagged player, and sends "left combat" once to those whose tags expired.
 * run() has a boundary catch on the outside: no exception may make the timer print a stack trace every second, so only the first is logged.
 */
public final class CombatTicker implements Runnable {

    private final Plugin plugin;
    private final CombatTagService service;
    private final LongSupplier clock;
    private boolean failureLogged;

    public CombatTicker(Plugin plugin, CombatTagService service, LongSupplier clock) {
        this.plugin = plugin;
        this.service = service;
        this.clock = clock;
    }

    @Override
    public void run() {
        try {
            tick();
        } catch (RuntimeException e) {
            if (!failureLogged) {
                failureLogged = true;
                plugin.getLogger().log(Level.SEVERE, "Combat ticker failed; further failures are not logged", e);
            }
        }
    }

    private void tick() {
        long now = clock.getAsLong();
        for (UUID id : service.expire(now)) {
            Player player = plugin.getServer().getPlayer(id);
            if (player != null) {
                player.sendActionBar(CombatMessages.left());
            }
        }
        for (UUID id : service.tagged()) {
            Player player = plugin.getServer().getPlayer(id);
            if (player != null) {
                player.sendActionBar(CombatMessages.countdown(service.remainingSeconds(id, now)));
            }
        }
    }
}
```

### `CombatTagApi.java` (public API, `api` package)

```java
package com.example.combat.api;

import java.util.Optional;
import java.util.UUID;

/**
 * The interface CombatTag exposes to other plugins (for example a duel plugin untagging at match start).
 *
 * <p>How to obtain it: {@code getServer().getServicesManager().load(CombatTagApi.class)}; load it before each call and do not cache it.
 * Rules are the same as paper-service-api: JDK types only, add-only, call on the main thread only.
 */
public interface CombatTagApi {

    boolean isTagged(UUID player);

    /** Remaining seconds; 0 if not tagged. */
    long remainingSeconds(UUID player);

    /** The last opponent; empty if not tagged. */
    Optional<UUID> lastAttacker(UUID player);

    /** Remove the tag; no-op if not tagged. */
    void untag(UUID player);
}
```

### `CombatTagApiImpl.java` (API implementation)

```java
package com.example.combat.adapter;

import com.example.combat.api.CombatTagApi;
import com.example.combat.core.CombatTagService;

import java.util.Optional;
import java.util.UUID;
import java.util.function.LongSupplier;

final class CombatTagApiImpl implements CombatTagApi {

    private final CombatTagService service;
    private final LongSupplier clock;

    CombatTagApiImpl(CombatTagService service, LongSupplier clock) {
        this.service = service;
        this.clock = clock;
    }

    @Override
    public boolean isTagged(UUID player) {
        return service.isTagged(player, clock.getAsLong());
    }

    @Override
    public long remainingSeconds(UUID player) {
        return service.remainingSeconds(player, clock.getAsLong());
    }

    @Override
    public Optional<UUID> lastAttacker(UUID player) {
        return service.lastAttacker(player, clock.getAsLong());
    }

    @Override
    public void untag(UUID player) {
        service.untag(player);
    }
}
```

### `CombatTagPlugin.java` (assembly)

```java
package com.example.combat.adapter;

import com.example.combat.api.CombatTagApi;
import com.example.combat.core.CombatTagService;
import org.bukkit.plugin.PluginManager;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.function.LongSupplier;

public final class CombatTagPlugin extends JavaPlugin {

    private CombatTagService service;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        CombatConfig config;
        try {
            config = CombatConfig.from(getConfig());
        } catch (IllegalArgumentException e) {
            getLogger().severe("Invalid config.yml: " + e.getMessage());
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        LongSupplier clock = System::currentTimeMillis;
        service = new CombatTagService(config.durationMillis());
        AttackerResolver resolver = new AttackerResolver(this, config.attributionWindowTicks());
        CombatTagger tagger = new CombatTagger(this, service, clock);

        PluginManager pm = getServer().getPluginManager();
        pm.registerEvents(new DamageListener(resolver, tagger), this);
        pm.registerEvents(new PotionListener(resolver, tagger), this);
        pm.registerEvents(new BombListener(resolver), this);
        pm.registerEvents(new CommandListener(this, service, config, clock), this);
        pm.registerEvents(new TeleportListener(service, config, clock), this);
        pm.registerEvents(new KickListener(service), this);
        pm.registerEvents(new QuitListener(service, config, clock), this);
        pm.registerEvents(new DeathListener(service), this);

        getServer().getScheduler().runTaskTimer(this, new CombatTicker(this, service, clock), 20L, 20L);

        // Register only after the rest of initialization is done, so consumers get a usable implementation
        getServer().getServicesManager().register(
            CombatTagApi.class, new CombatTagApiImpl(service, clock), this, ServicePriority.Normal);
    }

    @Override
    public void onDisable() {
        getServer().getServicesManager().unregisterAll(this);
        getServer().getScheduler().cancelTasks(this);
        if (service != null) {
            service.clear();
        }
    }
}
```

### `config.yml` and `plugin.yml`

```yaml
# config.yml
duration-seconds: 20
logout-mode: KILL            # KILL | DROP_ITEMS
attribution-window-ticks: 2  # lookup window for crystal / respawn anchor / bed
command-whitelist:           # use canonical command names; aliases and the minecraft: namespace are normalized automatically
  - msg
  - tell
  - r
blocked-teleport-causes:     # empty = COMMAND, PLUGIN
  - COMMAND
  - PLUGIN
```

```yaml
# plugin.yml
name: CombatTag
version: 1.0.0
main: com.example.combat.adapter.CombatTagPlugin
api-version: '26.2'
permissions:
  combattag.bypass:
    description: Never gets combat tagged
    default: op
```

## Recommended Directory Structure

```
src/main/java/com/example/combat/
├── core/                     <- no Bukkit, tested directly with JUnit
│   ├── CombatTagService.java
│   ├── ActionLedger.java
│   ├── CommandPolicy.java
│   ├── KickRule.java
│   └── TeleportRule.java
├── api/                      <- do not relocate, add-only
│   └── CombatTagApi.java
└── adapter/
    ├── CombatTagPlugin.java
    ├── CombatConfig.java / CombatMessages.java
    ├── AttackerResolver.java / CombatTagger.java / CombatTicker.java
    ├── CombatTagApiImpl.java
    └── *Listener.java
src/test/java/com/example/combat/core/
src/main/resources/{config.yml,plugin.yml}
```

## Thread Safety

- The core and all Listeners run only on the **main thread**; `CombatTagService` has no locks, so do not touch it from async tasks
- When an async phase needs data, take a snapshot on the main thread first (for example `remainingSeconds`) and pass the value in
- `CombatTicker` uses `runTaskTimer` (main thread); there is only one timer on the whole server, not one per player
- `onDisable` cancels tasks and calls `clear()`; if the API implementation must support other threads, it has to read an immutable snapshot instead
- See [`references/paper-threading.md`](references/paper-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| Hit by an explosion / potion but not tagged | The damage has no causing entity | Check the attribution matrix; crystals, anchors and beds rely on `ActionLedger`, potions on `PotionSplashEvent` |
| Kicked but not punished / let off instead | Judged with `PlayerQuitEvent#getReason()` | Use the `PlayerKickEvent.Cause` whitelist instead, so a second-client login does not become an escape method |
| Alias / namespaced commands bypass the whitelist | Only the string the player typed is compared | Resolve to the canonical name with `CommandMap#getCommand` before comparing |
| Pearls are blocked during combat too | All `TeleportCause` values are blocked | Block only `COMMAND` and `PLUGIN` (adjustable in config) |
| Burning keeps the tag from ever ending | Environmental damage also resets the tag | Never reset on damage without a player attribution |
| Stack trace every second | Exception inside the timer | Boundary catch around `run()`, log only the first |
| A death was cancelled but the tag was cleared | Listener did not set `ignoreCancelled` | `MONITOR` + `ignoreCancelled = true` |
| Other plugins cannot get `CombatTagApi` | The API package was relocated, or `load` was too early | See [`paper-service-api`](../paper-service-api/SKILL.md): `softdepend`, no caching, no relocation |
