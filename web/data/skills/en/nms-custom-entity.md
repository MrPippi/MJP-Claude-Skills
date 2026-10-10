# NMS Custom Entity

## Purpose

Extend an NMS Mob class and override `registerGoals()` to add custom `PathfinderGoal`s, implementing custom AI behavior. Suitable for custom bosses, NPCs, guards, and similar scenarios.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- `paper-plugin.yml` (ensures NMS loads before Bukkit plugins)

---

## Generated Code

### CustomZombie.java

```java
import net.minecraft.world.entity.monster.zombie.Zombie; // Since 26.x it lives in the monster.zombie subpackage

@SuppressWarnings("UnstableApiUsage")
public class CustomZombie extends Zombie {

    public CustomZombie(EntityType<? extends Zombie> type, Level level) {
        super(type, level);
    }

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(0, new FloatGoal(this));
        this.goalSelector.addGoal(1, new FollowClosestPlayerGoal(this, 1.2D, 32.0D));
        this.goalSelector.addGoal(2, new MeleeAttackGoal(this, 1.0D, false));
        this.targetSelector.addGoal(1,
            new NearestAttackableTargetGoal<>(this, Player.class, true));
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Zombie.createAttributes()
            .add(Attributes.MAX_HEALTH, 40.0D)
            .add(Attributes.ATTACK_DAMAGE, 8.0D);
    }
}
```

### FollowClosestPlayerGoal.java (custom PathfinderGoal)

```java
public class FollowClosestPlayerGoal extends Goal {
    @Override public boolean canUse() { /* find the closest player */ }
    @Override public void start() { mob.getNavigation().moveTo(target, speed); }
    @Override public void tick() { /* re-plan the path every 10 ticks */ }
}
```

---

## Thread Safety

- Entity creation and `addFreshEntity()` must be on the main thread
- `PathfinderGoal.tick()` is called on the main thread by the NMS tick loop
