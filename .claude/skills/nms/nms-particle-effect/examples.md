# examples — nms-particle-effect

## 範例 1：客戶端專屬粒子（只對特定玩家顯示）

**Input:**
```
package_name: com.example.effect
include_shapes: false
```

**Output — 只在目標玩家視角顯示傷害粒子:**
```java
@EventHandler
public void onDamage(EntityDamageByEntityEvent event) {
    if (!(event.getDamager() instanceof Player attacker)) return;

    Location hitLoc = event.getEntity().getLocation().add(0, 1, 0);

    // 只對攻擊者顯示命中粒子（客戶端專屬）
    ParticleEffect.send(
        attacker,
        ParticleTypes.CRIT,
        hitLoc,
        10,         // 數量
        0.2, 0.2, 0.2, // 偏移
        0.1,        // 速度
        false       // 不強制顯示
    );
}
```

---

## 範例 2：Builder 模式廣播粒子效果

**Input:**
```
package_name: com.example.effect
include_shapes: true
```

**Output — 對世界所有玩家廣播魔法粒子:**
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

## 範例 3：圓形粒子效果（保護區邊界）

**Input:**
```
package_name: com.example.effect
include_shapes: true
```

**Output — 每秒在保護區邊界顯示圓形粒子:**
```java
Location center = protectedZone.getCenter();
double radius = protectedZone.getRadius();

Bukkit.getScheduler().runTaskTimer(plugin, () -> {
    for (Player p : center.getWorld().getPlayers()) {
        if (p.getLocation().distance(center) < radius + 20) {
            ParticleShapes.circle(p, center, radius, 72, ParticleTypes.ENCHANT);
        }
    }
}, 0L, 20L); // 每秒執行
```

---

## 範例 4：螺旋粒子升天效果

**Input:**
```
package_name: com.example.effect
include_shapes: true
```

**Output — 玩家死亡時產生螺旋粒子:**
```java
@EventHandler
public void onDeath(PlayerDeathEvent event) {
    Player dead = event.getEntity();
    Location deathLoc = dead.getLocation();

    // 對所有 30 格內玩家顯示螺旋粒子
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
