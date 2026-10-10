
# Paper Combat Tag

## Purpose

After players fight each other they enter a combat state: while in it, commands, plugin teleports and logging out are forbidden (logging out counts as dying). The core `CombatTagService` uses only `UUID` and millisecond timestamps, contains no Bukkit types and can be tested directly with JUnit; listeners only translate Bukkit events into core inputs. Other plugins obtain `CombatTagApi` through `ServicesManager`.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (compile-verified on both)
- Pure Paper API, no Paperweight needed
- Java 21 (1.21.11) / 25 (26.2)

---

## Damage Attribution Matrix

| Source | Check |
|------|------|
| Melee | `DamageSource#getCausingEntity()` is a `Player` |
| Projectile | `Projectile#getShooter()` |
| Splash / lingering potion, effect cloud | `PotionSplashEvent` / `AreaEffectCloudApplyEvent` + harmful effect |
| TNT | `TNTPrimed#getSource()` |
| End crystal, respawn anchor, bed | Record on click / when hitting the crystal, look back within a 1-2 tick window on explosion |
| Tamed wolf | `Tameable#getOwnerUniqueId()` (owner online) |
| Fire, fall damage (after being hit) | Do not reset the tag |
| Self-damage, cancelled events | Ignored (`MONITOR` + `ignoreCancelled`) |

---

## Generated Code

### CombatTagService.java (core, no Bukkit)

```text
public Set<UUID> hit(UUID victim, UUID attacker, long now, boolean victimBypass, boolean attackerBypass);
public boolean isTagged(UUID player, long now);
public long remainingSeconds(UUID player, long now);
public Set<UUID> expire(long now);
public void markKicked(UUID player, boolean exemptFromPunishment);
public LogoutVerdict onQuit(UUID player, long now);   // NONE | PUNISH
```

### CommandListener.java (whitelist, including aliases and namespaces)

```java
String raw = CommandPolicy.rawToken(event.getMessage());
Command command = plugin.getServer().getCommandMap().getCommand(raw);
String name = command != null
    ? command.getName().toLowerCase(Locale.ROOT)
    : CommandPolicy.stripNamespace(raw);
if (!CommandPolicy.allowed(name, config.commandWhitelist())) {
    event.setCancelled(true);
}
```

### CombatTagPlugin.java (register the API)

```java
getServer().getServicesManager().register(
    CombatTagApi.class, new CombatTagApiImpl(service, clock), this, ServicePriority.Normal);
```

---

## Rules

- The core and API use only JDK types; the API is add-only, never changed, and must not be relocated
- Damage and death listeners use `MONITOR` + `ignoreCancelled = true`
- Whether a kick is exempt from death depends on a `PlayerKickEvent.Cause` whitelist, not on `PlayerQuitEvent#getReason()`
- The command whitelist first resolves through `CommandMap` to the canonical command name and then compares
- Teleports are blocked only for `COMMAND` / `PLUGIN`; ender pearls, chorus fruit and portals are allowed
- The whole server has a single per-second timer, with an outer boundary catch that logs only once

---

## Thread Safety

- The core and listeners are used on the main thread only, with no locking
- Async stages pass only UUIDs / numbers; after returning to the main thread, revalidate that the player is online
