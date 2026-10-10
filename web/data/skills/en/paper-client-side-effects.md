
# Paper Client-Side Effects

## Purpose

When you need an effect that only one player can see, **use the Paper API first, and consider packets or NMS only afterwards**. The most common bug with these effects is that they get silently removed or replaced after being applied (real border changed, world change, death, drinking milk, `/effect clear`), so keep the desired state centrally in `EffectState` and call `reconcile()` after every triggering event to reapply it.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (compile-verified on both)
- Pure Paper API, no Paperweight needed, no ProtocolLib / PacketEvents needed
- The preference source is obtained through `paper-service-api`

---

## Generated Code

### Virtual border red frame (LowHealthBorderEffect)

```java
WorldBorder virtual = server.createWorldBorder();
virtual.setCenter(target.centerX(), target.centerZ());
virtual.setSize(target.size());
virtual.setWarningDistance(target.warningDistance());   // distance / (1 - intensity)
player.setWorldBorder(virtual);
// Restore
player.setWorldBorder(null);
```

### Personal time and weather (PersonalTimeWeatherEffect)

```java
player.setPlayerTime(6000L, false);          // Fixed at noon; true = relative to server time
player.setPlayerWeather(WeatherType.CLEAR);
player.resetPlayerTime();
player.resetPlayerWeather();
```

### Plugin-scoped hiding (PlayerVisibilityService)

```java
viewer.hidePlayer(plugin, target);
viewer.showPlayer(plugin, target);   // Show again before logout
```

### Central reconcile (EffectState)

```java
public void reconcile(Player player) {
    EffectPrefs prefs = desired.getOrDefault(player.getUniqueId(), EffectPrefs.NONE);
    border.apply(player, prefs.lowHealthBorder());
    timeWeather.apply(player, prefs);
    if (prefs.nightVision()) nightVision.apply(player);
}
```

---

## Rules

- For triggering events (join, world change, respawn, `WorldBorder*Event`, `EntityPotionEffectEvent`), always `runTask` to the next tick and then `reconcile()`
- Red frame: on world change call `setWorldBorder(null)` first and then recompute; recopy when the real border changes; restore when disabled; use a periodic scan for health changes
- Check night vision with `PotionEffect#isInfinite()`, not "has night vision"
- On join, `hidePlayer` recomputes in both directions and `showPlayer` runs before logout; it also removes the player from the TAB list

---

## Thread Safety

- Everything runs on the main thread only; the preference source reads only an in-memory cache
- Callbacks deferred from events re-fetch the `Player` by UUID
