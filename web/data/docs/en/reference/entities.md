# NMS Entity & AI Reference

Applicable versions: Paper 1.21.11 / 26.2 (Mojang official names; vanilla is no longer obfuscated since 26.1). Where the two versions differ, the code is marked with an end-of-line `// @1.21.11:` comment or a `// @only <version>` block.
Package root: `net.minecraft.world.entity`

> For custom entity usage, see `Skills/nms/nms-custom-entity/SKILL.md`

---

## Entity Class Hierarchy

```
net.minecraft.world.entity.Entity
└── net.minecraft.world.entity.LivingEntity
    ├── net.minecraft.world.entity.player.Player
    │   └── net.minecraft.server.level.ServerPlayer       ← NMS player
    └── net.minecraft.world.entity.Mob                    ← Mobs with AI
        ├── net.minecraft.world.entity.PathfinderMob      ← Has pathfinding
        │   ├── net.minecraft.world.entity.ambient.Bat
        │   ├── net.minecraft.world.entity.animal.*       ← Animals
        │   │   ├── Chicken, Cow, Pig, Sheep, Wolf...
        │   │   ├── Horse (AbstractHorse subclass)
        │   │   └── TamableAnimal (Wolf, Cat, Parrot)
        │   ├── net.minecraft.world.entity.monster.*      ← Monsters
        │   │   ├── Zombie (extends Monster)
        │   │   ├── Skeleton (extends AbstractSkeleton)
        │   │   ├── Creeper
        │   │   ├── Spider
        │   │   ├── Enderman
        │   │   └── Slime (extends Mob directly)
        │   └── net.minecraft.world.entity.npc.*          ← NPCs
        │       └── Villager, Wandering Trader
        └── net.minecraft.world.entity.boss.*
            ├── EnderDragon
            └── WitherBoss
```

---

## Bukkit ↔ NMS Entity Mapping

| Bukkit class | NMS class | Conversion |
|-----------|--------|------|
| `org.bukkit.entity.Player` | `ServerPlayer` | `((CraftPlayer) p).getHandle()` |
| `org.bukkit.entity.Zombie` | `Zombie` | `((CraftZombie) e).getHandle()` |
| `org.bukkit.entity.LivingEntity` | `LivingEntity` | `((CraftLivingEntity) e).getHandle()` |
| `org.bukkit.entity.Entity` (generic) | `Entity` | `((CraftEntity) e).getHandle()` |

Reverse (NMS → Bukkit):
```java
org.bukkit.entity.Entity bukkit = nmsEntity.getBukkitEntity();
```

---

## AI Goal System

### Goal Priority Conventions

`goalSelector.addGoal(priority, goal)` — **the smaller the number, the higher the priority**

| Priority | Typical usage |
|----------|---------|
| 0 | `FloatGoal` (swimming, highest priority) |
| 1–2 | Combat-related (attack, flee) |
| 3–5 | Follow a target (movement) |
| 6–8 | Random patrol, idle looking |
| 9+ | Low-priority random behavior |

### Goal.Flag Enum

`setFlags(EnumSet.of(Goal.Flag.MOVE, Goal.Flag.LOOK))`

| Flag | Description | Exclusivity |
|------|------|---------|
| `MOVE` | Controls movement | Only one MOVE goal can run at a time |
| `LOOK` | Controls facing direction | Only one LOOK goal can run at a time |
| `JUMP` | Controls jumping | Only one JUMP goal can run at a time |
| `TARGET` | Controls target selection | Used in targetSelector |

> A goal that uses no flags can run concurrently with others.

### Built-in Goal Classes

#### Movement (MOVE flag)

| Class | Behavior | Main parameters |
|------|------|---------|
| `FloatGoal(mob)` | Swim in water | — |
| `MeleeAttackGoal(mob, speed, followEvenIfNotSeeTarget)` | Melee chase | speed=multiplier, follow=keep chasing after losing line of sight |
| `WaterAvoidingRandomStrollGoal(mob, speed)` | Random wandering (avoids water) | speed=movement speed multiplier |
| `WaterAvoidingRandomFlyingGoal(mob, speed)` | Random flying (avoids water) | — |
| `RandomStrollGoal(mob, speed)` | Random wandering | — |
| `PathfindToRaidGoal(mob)` | Head to the raid location | — |
| `FollowOwnerGoal(tameable, speed, minDist, maxDist)` | Follow the owner | — |
| `FollowMobGoal(mob, speed, minDist, areaSize)` | Follow another mob | — |
| `LeapAtTargetGoal(mob, velY)` | Leap attack | velY=vertical velocity |

#### Looking (LOOK flag)

| Class | Behavior |
|------|------|
| `LookAtPlayerGoal(mob, targetClass, range)` | Look at the nearest player |
| `LookAtPlayerGoal(mob, targetClass, range, probability)` | Look at a player with some probability |
| `RandomLookAroundGoal(mob)` | Look around randomly |

#### Target Selection (used in targetSelector)

| Class | Behavior |
|------|------|
| `NearestAttackableTargetGoal<T>(mob, targetClass, mustSee)` | Attack the nearest target of the given type |
| `NearestAttackableTargetGoal<T>(mob, targetClass, intervalTicks, mustSee, mustReach, predicate)` | With condition filtering |
| `HurtByTargetGoal(mob, ignoredClasses...)` | Retaliate when attacked |
| `DefendVillageTargetGoal(mob)` | Protect villagers |
| `OwnerHurtByTargetGoal(tameable)` | Assist when the owner is attacked |
| `ResetUniversalAngerTargetGoal<T>(mob, notifyOthers)` | Reset the anger target |

### Removing Goals

```java
// Remove all MOVE-type goals
mob.goalSelector.removeAllGoals(g -> g instanceof MeleeAttackGoal);

// Clear everything and rebuild
mob.goalSelector.removeAllGoals(g -> true);
mob.targetSelector.removeAllGoals(g -> true);
```

### Custom Goal Template

```java
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.goal.Goal;
import java.util.EnumSet;

public class MyGoal extends Goal {

    private final Mob mob;

    public MyGoal(Mob mob) {
        this.mob = mob;
        this.setFlags(EnumSet.of(Flag.MOVE)); // Declare which flags it controls
    }

    @Override
    public boolean canUse() {
        return /* start condition */;
    }

    @Override
    public boolean canContinueToUse() {
        return /* continue condition (calls canUse() by default) */;
    }

    @Override
    public void start() { /* start running */ }

    @Override
    public void stop() { /* clean up */ }

    @Override
    public void tick() { /* runs every tick */ }
}
```

---

## Navigation

```java
import net.minecraft.world.entity.ai.navigation.PathNavigation;

PathNavigation nav = mob.getNavigation();

// Move to a target
nav.moveTo(targetX, targetY, targetZ, speedModifier); // speedModifier: 1.0 = normal speed
nav.moveTo(targetEntity, speedModifier);              // Track an entity

// Stop moving
nav.stop();

// Check whether it is moving
boolean moving = !nav.isDone();

// Force a re-plan (call once every N ticks, not every tick)
nav.recomputePath();
```

---

## Look Control

```java
import net.minecraft.world.entity.ai.control.LookControl;

LookControl look = mob.getLookControl();

look.setLookAt(targetEntity, yRotSpeed, xRotSpeed); // Speed unit: degrees/tick
look.setLookAt(x, y, z);
```

---

## Attribute Constants

All constants are in `net.minecraft.world.entity.ai.attributes.Attributes`:

| Constant | Description | Default value range |
|--------|------|-----------|
| `MAX_HEALTH` | Max health | 0 – 1024 |
| `ATTACK_DAMAGE` | Attack damage | 0 – 2048 |
| `ATTACK_SPEED` | Attack speed | 0 – 1024 |
| `ATTACK_KNOCKBACK` | Attack knockback | 0 – 5 |
| `MOVEMENT_SPEED` | Movement speed (base value) | 0 – 1024 |
| `FLYING_SPEED` | Flying speed | 0 – 1024 |
| `ARMOR` | Armor value | 0 – 30 |
| `ARMOR_TOUGHNESS` | Armor toughness | 0 – 20 |
| `KNOCKBACK_RESISTANCE` | Knockback resistance (1.0=fully immune) | 0 – 1 |
| `FOLLOW_RANGE` | Tracking/detection range | 0 – 2048 |
| `SPAWN_REINFORCEMENTS_CHANCE` | Chance to summon reinforcements (Zombie) | 0 – 1 |
| `MAX_ABSORPTION` | Absorption effect cap | 0 – 2048 |
| `LUCK` | Luck value | -1024 – 1024 |

### Setting Attributes

```java
import net.minecraft.world.entity.ai.attributes.Attributes;

// Modify attributes of an existing entity
Objects.requireNonNull(mob.getAttribute(Attributes.MAX_HEALTH)).setBaseValue(100.0);
mob.setHealth(100.0f); // Also set the current health

// Set at construction (custom entity)
public static AttributeSupplier.Builder createAttributes() {
    return Zombie.createAttributes()
        .add(Attributes.MAX_HEALTH, 100.0D)
        .add(Attributes.ATTACK_DAMAGE, 10.0D)
        .add(Attributes.MOVEMENT_SPEED, 0.35D)
        .add(Attributes.KNOCKBACK_RESISTANCE, 0.5D)
        .add(Attributes.FOLLOW_RANGE, 64.0D);
}
```

---

## EntityType Constants Cheat Sheet

`net.minecraft.world.entity.EntityTypes` (since 26.x, the vanilla constants moved from `EntityType` to `EntityTypes`; the type is still `EntityType<?>`; **on 1.21.11 use `EntityType.XXX` instead**) — common values:

| Constant | Entity | Bukkit equivalent |
|------|------|------------|
| `EntityTypes.ZOMBIE` | Zombie | `EntityType.ZOMBIE` |
| `EntityTypes.SKELETON` | Skeleton | `EntityType.SKELETON` |
| `EntityTypes.CREEPER` | Creeper | `EntityType.CREEPER` |
| `EntityTypes.ENDERMAN` | Enderman | `EntityType.ENDERMAN` |
| `EntityTypes.SPIDER` | Spider | `EntityType.SPIDER` |
| `EntityTypes.IRON_GOLEM` | Iron Golem | `EntityType.IRON_GOLEM` |
| `EntityTypes.VILLAGER` | Villager | `EntityType.VILLAGER` |
| `EntityTypes.WITHER` | Wither | `EntityType.WITHER` |
| `EntityTypes.ARMOR_STAND` | Armor Stand | `EntityType.ARMOR_STAND` |
| `EntityTypes.ITEM` | Dropped item | `EntityType.ITEM` |
| `EntityTypes.EXPERIENCE_ORB` | Experience Orb | `EntityType.EXPERIENCE_ORB` |
| `EntityTypes.FIREBALL` | Fireball | `EntityType.FIREBALL` |
| `EntityTypes.ARROW` | Arrow | `EntityType.ARROW` |

---

## SpawnReason Mapping

| NMS `MobSpawnType` (renamed `EntitySpawnReason` in 1.21.2+) | Bukkit `SpawnReason` | Description |
|--------------------|---------------------|------|
| `NATURAL` | `NATURAL` | Natural spawn |
| `CHUNK_GENERATION` | `CHUNK_GEN` | Chunk generation |
| `SPAWNER` | `SPAWNER` | Mob spawner |
| `COMMAND` | `COMMAND` | `/summon` command |
| `SPAWN_EGG` | `SPAWN_EGG` | Spawn egg |
| `REINFORCEMENT` | `REINFORCEMENTS` | Reinforcements (Zombie) |
| `TRIGGERED` | `BUILD_SNOWMAN` / `BUILD_IRONGOLEM` | Special construction |

For plugin-defined spawns, use Bukkit's `CreatureSpawnEvent.SpawnReason.CUSTOM`:
```java
level.addFreshEntity(mob, CreatureSpawnEvent.SpawnReason.CUSTOM);
```

---

## Entity Spawning and Removal

```java
// Spawn
ServerLevel level = ((CraftWorld) world).getHandle();
mob.snapTo(x, y, z, yaw, pitch); // 26.x: Entity.moveTo() was renamed to snapTo()
level.addFreshEntity(mob, CreatureSpawnEvent.SpawnReason.CUSTOM);

// Mark as persistent (does not disappear when the chunk unloads)
mob.setPersistenceRequired(true);

// Remove
mob.discard(); // Remove immediately (does not fire the Death event)
mob.kill();    // Fires the Death event
```

---

## Related Skills

- `Skills/nms/nms-custom-entity/SKILL.md` — Custom entities and AI
- `docs/paper-nms/bukkit-nms-bridge.md` — Bukkit ↔ NMS bridge
- `Skills/_shared/nms-threading.md` — Threading rules (entity operations must run on the main thread)
