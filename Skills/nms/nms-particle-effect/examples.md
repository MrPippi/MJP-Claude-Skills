# examples — nms-particle-effect

## Example 1: Client-Specific Particles (Shown Only to Selected Players)

**Input:**
```
package_name: com.example.effect
include_shapes: false
```

**Output — show damage particles only to the target player:**
```java
@EventHandler
public void onDamage(EntityDamageByEntityEvent event) {
    if (!(event.getDamager() instanceof Player attacker)) return;

    Location hitLoc = event.getEntity().getLocation().add(0, 1, 0);

    // Show hit particles only to the attacker (client-specific)
    ParticleEffect.send(
        attacker,
        ParticleTypes.CRIT,
        hitLoc,
        10,         // count
        0.2, 0.2, 0.2, // offset
        0.1,        // speed
        false       // do not force display
    );
}
```

---

## Example 2: Broadcast Particle Effects With the Builder Pattern

**Input:**
```
package_name: com.example.effect
include_shapes: true
```

**Output — broadcast enchant particles to all players in the world:**
```java
Location center = world.getSpawnLocation().add(0, 1, 0);

new ParticleBuilder()
    .particle(ParticleTypes.ENCHANT)
    .at(center)
    .count(50)
    .offset(1.0, 1.0, 1.0)
    .speed(0.05)
    .receivers(world.getPlayers())
    .spawn();
```

---

## Example 3: Circle Particle Effect (Protected Zone Border)

**Input:**
```
package_name: com.example.effect
include_shapes: true
```

**Output — show circle particles on the protected zone border every second:**
```java
Location center = protectedZone.getCenter();
double radius = protectedZone.getRadius();

Bukkit.getScheduler().runTaskTimer(plugin, () -> {
    for (Player p : center.getWorld().getPlayers()) {
        if (p.getLocation().distance(center) < radius + 20) {
            ParticleShapes.circle(p, center, radius, 72, ParticleTypes.ENCHANT);
        }
    }
}, 0L, 20L); // runs every second
```

---

## Example 4: Ascending Spiral Particle Effect

**Input:**
```
package_name: com.example.effect
include_shapes: true
```

**Output — spawn spiral particles when a player dies:**
```java
@EventHandler
public void onDeath(PlayerDeathEvent event) {
    Player dead = event.getEntity();
    Location deathLoc = dead.getLocation();

    // Show spiral particles to all players within 30 blocks
    List<Player> viewers = deathLoc.getWorld().getPlayers().stream()
        .filter(p -> p.getLocation().distance(deathLoc) <= 30)
        .toList();

    new BukkitRunnable() {
        int tick = 0;

        @Override
        public void run() {
            if (tick++ >= 3) { cancel(); return; }
            for (Player viewer : viewers) {
                ParticleShapes.helix(viewer, deathLoc, 0.5, 3.0, 3, 16, ParticleTypes.SOUL);
            }
        }
    }.runTaskTimer(plugin, 0L, 5L);
}
```
