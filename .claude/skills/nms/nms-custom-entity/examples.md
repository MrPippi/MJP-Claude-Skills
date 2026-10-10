# examples — nms-custom-entity

## Example 1: Extend Zombie and Boost Attributes

**Input:**
```
package_name: com.example.entities
entity_class_name: BossZombie
base_entity: Zombie
entity_id: my_boss_zombie
goal_class_name: BossChargeGoal
```

**Output — BossZombie.java (key section):**
```java
import net.minecraft.world.entity.monster.zombie.Zombie; // Located in the monster.zombie subpackage since 26.x

public class BossZombie extends Zombie {
    public BossZombie(EntityType<? extends Zombie> type, Level level) {
        super(type, level);
    }

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(0, new FloatGoal(this));
        this.goalSelector.addGoal(1, new BossChargeGoal(this, 2.0D, 64.0D));
        this.goalSelector.addGoal(2, new MeleeAttackGoal(this, 1.5D, false));
        this.targetSelector.addGoal(1,
            new NearestAttackableTargetGoal<>(this, Player.class, true));
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Zombie.createAttributes()
            .add(Attributes.MAX_HEALTH, 200.0D)
            .add(Attributes.ATTACK_DAMAGE, 15.0D)
            .add(Attributes.KNOCKBACK_RESISTANCE, 1.0D);
    }
}
```

**Usage:**
```java
Location spawnLoc = player.getLocation();
Entity boss = EntitySpawner.spawnBoss(spawnLoc);
boss.setCustomName("§4§lBlood Lord");
```

---

## Example 2: Goal That Patrols Around a Player

**Input:**
```
package_name: com.example.entities
entity_class_name: GuardianEntity
base_entity: IronGolem
entity_id: patrol_guardian
goal_class_name: CirclePatrolGoal
```

**Output — CirclePatrolGoal.java:**
```java
public class CirclePatrolGoal extends Goal {
    private final Mob mob;
    private final Player target;
    private final double radius;
    private double angle;

    public CirclePatrolGoal(Mob mob, Player target, double radius) {
        this.mob = mob;
        this.target = target;
        this.radius = radius;
        this.setFlags(EnumSet.of(Flag.MOVE));
    }

    @Override
    public boolean canUse() {
        return target.isAlive();
    }

    @Override
    public void tick() {
        angle += 0.05;
        double x = target.getX() + Math.cos(angle) * radius;
        double z = target.getZ() + Math.sin(angle) * radius;
        double y = target.getY();
        mob.getNavigation().moveTo(x, y, z, 1.0D);
    }
}
```

---

## Example 3: Replace Vanilla-Spawned Zombies (With a Custom Version)

**Input:**
```
package_name: com.example.entities
entity_class_name: StrongerZombie
base_entity: Zombie
```

**Output — EntityListener.java:**
```java
import org.bukkit.event.entity.CreatureSpawnEvent;
import org.bukkit.event.entity.EntitySpawnEvent;

public class EntityListener implements Listener {

    @EventHandler(ignoreCancelled = true)
    public void onSpawn(CreatureSpawnEvent event) {
        // Only intercept natural spawns
        if (event.getSpawnReason() != CreatureSpawnEvent.SpawnReason.NATURAL) return;
        if (!(event.getEntity() instanceof org.bukkit.entity.Zombie zombie)) return;

        Location loc = zombie.getLocation();
        event.setCancelled(true); // Cancel the vanilla spawn

        // Replace with the custom version
        ServerLevel nmsLevel = ((CraftWorld) loc.getWorld()).getHandle();
        StrongerZombie custom = new StrongerZombie(EntityTypes.ZOMBIE, nmsLevel); // @1.21.11: StrongerZombie custom = new StrongerZombie(EntityType.ZOMBIE, nmsLevel);
        custom.snapTo(loc.getX(), loc.getY(), loc.getZ());
        nmsLevel.addFreshEntity(custom, CreatureSpawnEvent.SpawnReason.CUSTOM);
    }
}
```

---

## Example 4: Boss With a Custom Health Bar (Using Bukkit BossBar)

**Input:**
```
package_name: com.example.entities
entity_class_name: AncientGuardian
base_entity: Zombie
```

**Usage: spawn + attach a BossBar:**
```java
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;

public void summonBoss(Location loc) {
    Entity boss = EntitySpawner.spawnAncientGuardian(loc);
    UUID bossId = boss.getUniqueId();

    BossBar bar = BossBar.bossBar(
        Component.text("§4Ancient Guardian"),
        1.0f,
        BossBar.Color.RED,
        BossBar.Overlay.PROGRESS);

    // Update the health bar every tick
    Bukkit.getScheduler().runTaskTimer(plugin, () -> {
        Entity entity = Bukkit.getEntity(bossId);
        if (!(entity instanceof LivingEntity living) || living.isDead()) return;
        double percent = living.getHealth() / living.getMaxHealth();
        bar.progress((float) percent);

        // Broadcast to nearby players
        living.getWorld().getNearbyPlayers(living.getLocation(), 50)
            .forEach(p -> p.showBossBar(bar));
    }, 0L, 1L);
}
```
