---
name: nms-custom-entity
description: "建立自定義 NMS 實體：繼承現有 Mob 類別、自訂 PathfinderGoal、替換 vanilla 實體行為 / Create custom NMS entities with custom PathfinderGoal AI"
---

# NMS Custom Entity

## Skill Name

`nms-custom-entity`

## Purpose

Extend an NMS Mob class and override `registerGoals()` to add custom `PathfinderGoal`s for custom AI behavior. Suited to custom bosses, NPCs, guards, and similar scenarios.

### Related Skills

- Bots that need a player appearance and real-player behavior (crits, shield blocking, knockback) → [`nms-fake-player`](../nms-fake-player/SKILL.md)
- If a mob only needs adjusted attributes or AI goals, try the Paper API first (`Mob#getPathfinder`, `Attribute`) before NMS

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Requires `paper-plugin.yml` (ensures loading before Bukkit plugins)

## Triggers

- 「自定義實體」「custom entity」「NMS AI」
- 「PathfinderGoal」「自訂 mob」「custom mob」
- 「entity goal」「custom zombie」「replace entity」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.entities` | Package of the generated classes |
| `entity_class_name` | `CustomZombie` | Custom entity class name |
| `base_entity` | `Zombie` | NMS base class to extend |
| `entity_id` | `my_custom_zombie` | Registration ID (namespaced) |
| `goal_class_name` | `FollowClosestPlayerGoal` | Custom goal class name |

## Outputs

- `CustomZombie.java` — custom entity extending `net.minecraft.world.entity.monster.zombie.Zombie`
- `FollowClosestPlayerGoal.java` — custom `PathfinderGoal` template
- `EntitySpawner.java` — spawn utility class
- `EntityListener.java`(optional) — intercepts vanilla spawns and replaces them with the custom entity

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md).

## Code Template

### `CustomZombie.java`

```java
package com.example.entities;

import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal;
import net.minecraft.world.entity.monster.zombie.Zombie;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;

@SuppressWarnings("UnstableApiUsage")
public class CustomZombie extends Zombie {

    public CustomZombie(EntityType<? extends Zombie> type, Level level) {
        super(type, level);
    }

    @Override
    protected void registerGoals() {
        // Swimming (required)
        this.goalSelector.addGoal(0, new FloatGoal(this));

        // Custom: lock onto the nearest player
        this.goalSelector.addGoal(1, new FollowClosestPlayerGoal(this, 1.2D, 32.0D));

        // Melee attack (speed multiplier 1.0, keeps chasing without letting go)
        this.goalSelector.addGoal(2, new MeleeAttackGoal(this, 1.0D, false));

        // Look around randomly
        this.goalSelector.addGoal(8, new LookAtPlayerGoal(this, Player.class, 8.0F));
        this.goalSelector.addGoal(8, new RandomLookAroundGoal(this));

        // Target selector: players first
        this.targetSelector.addGoal(1, new NearestAttackableTargetGoal<>(this, Player.class, true));
    }

    /** Custom attributes: higher health and attack damage. */
    public static net.minecraft.world.entity.ai.attributes.AttributeSupplier.Builder createAttributes() {
        return Zombie.createAttributes()
            .add(net.minecraft.world.entity.ai.attributes.Attributes.MAX_HEALTH, 40.0D)
            .add(net.minecraft.world.entity.ai.attributes.Attributes.ATTACK_DAMAGE, 8.0D)
            .add(net.minecraft.world.entity.ai.attributes.Attributes.MOVEMENT_SPEED, 0.3D);
    }
}
```

### `FollowClosestPlayerGoal.java`

```java
package com.example.entities;

import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.player.Player;

import java.util.EnumSet;

@SuppressWarnings("UnstableApiUsage")
public class FollowClosestPlayerGoal extends Goal {

    private final Mob mob;
    private final double speed;
    private final double range;
    private Player target;

    public FollowClosestPlayerGoal(Mob mob, double speed, double range) {
        this.mob = mob;
        this.speed = speed;
        this.range = range;
        this.setFlags(EnumSet.of(Flag.MOVE));
    }

    @Override
    public boolean canUse() {
        this.target = this.mob.level().getNearestPlayer(this.mob, this.range);
        return this.target != null && !this.target.isCreative() && !this.target.isSpectator();
    }

    @Override
    public boolean canContinueToUse() {
        return this.target != null
            && this.target.isAlive()
            && this.mob.distanceToSqr(this.target) < this.range * this.range;
    }

    @Override
    public void start() {
        this.mob.getNavigation().moveTo(this.target, this.speed);
    }

    @Override
    public void stop() {
        this.target = null;
        this.mob.getNavigation().stop();
    }

    @Override
    public void tick() {
        if (this.target == null) return;
        this.mob.getLookControl().setLookAt(this.target, 30.0F, 30.0F);
        // Re-plan the path every 10 ticks
        if (this.mob.tickCount % 10 == 0) {
            this.mob.getNavigation().moveTo(this.target, this.speed);
        }
    }
}
```

### `EntitySpawner.java`

```java
package com.example.entities;

import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.EntityTypes; // @1.21.11: import net.minecraft.world.entity.EntityType;
import org.bukkit.Location;
import org.bukkit.craftbukkit.CraftWorld;

@SuppressWarnings("UnstableApiUsage")
public final class EntitySpawner {

    private EntitySpawner() {}

    /**
     * Spawns the custom zombie at the given location. Must be called on the main thread.
     */
    public static org.bukkit.entity.Entity spawnCustomZombie(Location loc) {
        ServerLevel level = ((CraftWorld) loc.getWorld()).getHandle();

        // 26.x: vanilla EntityType constants moved to EntityTypes (1.21.11 still uses EntityType)
        CustomZombie zombie = new CustomZombie(EntityTypes.ZOMBIE, level); // @1.21.11: CustomZombie zombie = new CustomZombie(EntityType.ZOMBIE, level);
        zombie.snapTo(loc.getX(), loc.getY(), loc.getZ(), loc.getYaw(), loc.getPitch());

        // Set a custom name (shown above the head)
        zombie.setCustomName(net.minecraft.network.chat.Component.literal("§cCustom Zombie"));
        zombie.setCustomNameVisible(true);

        level.addFreshEntity(zombie, org.bukkit.event.entity.CreatureSpawnEvent.SpawnReason.CUSTOM);
        return zombie.getBukkitEntity();
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── entities/
    ├── CustomZombie.java
    ├── FollowClosestPlayerGoal.java
    ├── EntitySpawner.java
    └── EntityListener.java
```

## Thread Safety

- ⚠️ Entity creation, `addFreshEntity()`, and `snapTo()` **must run on the main thread**
- ⚠️ `PathfinderGoal.tick()` is called by NMS in the main-thread tick loop; do not do expensive work
- ⚠️ Make sure the chunk is loaded when accessing `mob.level()`
- ✅ Path data can be precomputed async, but `Navigation.moveTo()` must be called on the main thread
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| Entity does not move | `Goal.canUse()` never returns true | Add logging to check whether the target is being filtered out |
| Entity disappears after chunk unload | Not marked persistent | `zombie.setPersistenceRequired()` |
| Attributes have no effect | `createAttributes()` not registered | Custom Paper entities must be registered via `EntityType.Builder` (or reuse an existing type) |
| Client shows a blank entity | Entity type does not exist on the client | Extend a vanilla type (such as `Zombie`) instead of creating a new `EntityType` |
| `UnsupportedOperationException` in `registerGoals` | Goal added more than once | Clear `goalSelector` and rebuild: `goalSelector.removeAllGoals(g -> true)` |
