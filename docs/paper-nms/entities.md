# NMS 實體 & AI 速查表 / NMS Entity & AI Reference

適用版本：Paper 26.2（Mojang 官方命名；26.1 起原版不再混淆）
套件根：`net.minecraft.world.entity`

> 自定義實體用法見 `Skills/nms/nms-custom-entity/SKILL.md`

---

## 實體類層次圖 / Entity Class Hierarchy

```
net.minecraft.world.entity.Entity
└── net.minecraft.world.entity.LivingEntity
    ├── net.minecraft.world.entity.player.Player
    │   └── net.minecraft.server.level.ServerPlayer       ← NMS 玩家
    └── net.minecraft.world.entity.Mob                    ← 有 AI 的生物
        ├── net.minecraft.world.entity.PathfinderMob      ← 有路徑導航
        │   ├── net.minecraft.world.entity.ambient.Bat
        │   ├── net.minecraft.world.entity.animal.*       ← 動物
        │   │   ├── Chicken, Cow, Pig, Sheep, Wolf...
        │   │   ├── Horse（AbstractHorse 子類）
        │   │   └── TamableAnimal（Wolf, Cat, Parrot）
        │   ├── net.minecraft.world.entity.monster.*      ← 怪物
        │   │   ├── Zombie（繼承 Monster）
        │   │   ├── Skeleton（繼承 AbstractSkeleton）
        │   │   ├── Creeper
        │   │   ├── Spider
        │   │   ├── Enderman
        │   │   └── Slime（繼承 Mob 直接）
        │   └── net.minecraft.world.entity.npc.*          ← NPC
        │       └── Villager, Wandering Trader
        └── net.minecraft.world.entity.boss.*
            ├── EnderDragon
            └── WitherBoss
```

---

## Bukkit ↔ NMS 實體對照

| Bukkit 類 | NMS 類 | 轉換 |
|-----------|--------|------|
| `org.bukkit.entity.Player` | `ServerPlayer` | `((CraftPlayer) p).getHandle()` |
| `org.bukkit.entity.Zombie` | `Zombie` | `((CraftZombie) e).getHandle()` |
| `org.bukkit.entity.LivingEntity` | `LivingEntity` | `((CraftLivingEntity) e).getHandle()` |
| `org.bukkit.entity.Entity`（通用） | `Entity` | `((CraftEntity) e).getHandle()` |

反向（NMS → Bukkit）：
```java
org.bukkit.entity.Entity bukkit = nmsEntity.getBukkitEntity();
```

---

## AI Goal 系統 / Goal System

### Goal 優先級慣例

`goalSelector.addGoal(priority, goal)` — **數字越小優先級越高**

| Priority | 典型用途 |
|----------|---------|
| 0 | `FloatGoal`（游泳，最高優先） |
| 1–2 | 戰鬥相關（攻擊、逃跑） |
| 3–5 | 跟隨目標（移動） |
| 6–8 | 隨機巡邏、觀望 |
| 9+ | 低優先隨機行為 |

### Goal.Flag 枚舉

`setFlags(EnumSet.of(Goal.Flag.MOVE, Goal.Flag.LOOK))`

| Flag | 說明 | 互斥效果 |
|------|------|---------|
| `MOVE` | 控制移動 | 同時只能一個 MOVE goal 執行 |
| `LOOK` | 控制朝向 | 同時只能一個 LOOK goal 執行 |
| `JUMP` | 控制跳躍 | 同時只能一個 JUMP goal 執行 |
| `TARGET` | 控制目標選擇 | 用於 targetSelector |

> 若 Goal 不消耗任何 flag，多個可同時執行。

### 內建 Goal 類一覽

#### 移動類（MOVE flag）

| 類名 | 行為 | 主要參數 |
|------|------|---------|
| `FloatGoal(mob)` | 水中游泳 | — |
| `MeleeAttackGoal(mob, speed, followEvenIfNotSeeTarget)` | 近戰追擊 | speed=倍率, follow=失去視線後繼續追 |
| `WaterAvoidingRandomStrollGoal(mob, speed)` | 隨機遊蕩（避水） | speed=移動速度倍率 |
| `WaterAvoidingRandomFlyingGoal(mob, speed)` | 隨機飛行（避水） | — |
| `RandomStrollGoal(mob, speed)` | 隨機遊蕩 | — |
| `PathfindToRaidGoal(mob)` | 前往突襲地點 | — |
| `FollowOwnerGoal(tameable, speed, minDist, maxDist)` | 跟隨主人 | — |
| `FollowMobGoal(mob, speed, minDist, areaSize)` | 跟隨其他 mob | — |
| `LeapAtTargetGoal(mob, velY)` | 跳躍攻擊 | velY=縱向速度 |

#### 觀望類（LOOK flag）

| 類名 | 行為 |
|------|------|
| `LookAtPlayerGoal(mob, targetClass, range)` | 注視最近玩家 |
| `LookAtPlayerGoal(mob, targetClass, range, probability)` | 機率性注視 |
| `RandomLookAroundGoal(mob)` | 隨機四處看 |

#### 目標選擇類（targetSelector 用）

| 類名 | 行為 |
|------|------|
| `NearestAttackableTargetGoal<T>(mob, targetClass, mustSee)` | 攻擊最近指定類型目標 |
| `NearestAttackableTargetGoal<T>(mob, targetClass, intervalTicks, mustSee, mustReach, predicate)` | 帶條件篩選 |
| `HurtByTargetGoal(mob, ignoredClasses...)` | 被攻擊時反擊 |
| `DefendVillageTargetGoal(mob)` | 保護村民 |
| `OwnerHurtByTargetGoal(tameable)` | 主人被攻擊時協助 |
| `ResetUniversalAngerTargetGoal<T>(mob, notifyOthers)` | 重設憤怒目標 |

### 移除 Goal

```java
// 移除所有 MOVE 類 goal
mob.goalSelector.removeAllGoals(g -> g instanceof MeleeAttackGoal);

// 完全清空並重建
mob.goalSelector.removeAllGoals(g -> true);
mob.targetSelector.removeAllGoals(g -> true);
```

### 自訂 Goal 範本

```java
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.goal.Goal;
import java.util.EnumSet;

public class MyGoal extends Goal {

    private final Mob mob;

    public MyGoal(Mob mob) {
        this.mob = mob;
        this.setFlags(EnumSet.of(Flag.MOVE)); // 聲明控制哪些 flag
    }

    @Override
    public boolean canUse() {
        return /* 啟動條件 */;
    }

    @Override
    public boolean canContinueToUse() {
        return /* 持續條件（預設呼叫 canUse()）*/;
    }

    @Override
    public void start() { /* 開始執行 */ }

    @Override
    public void stop() { /* 清理 */ }

    @Override
    public void tick() { /* 每 tick 執行 */ }
}
```

---

## 路徑導航 / Navigation

```java
import net.minecraft.world.entity.ai.navigation.PathNavigation;

PathNavigation nav = mob.getNavigation();

// 移動至目標
nav.moveTo(targetX, targetY, targetZ, speedModifier); // speedModifier: 1.0 = 正常速度
nav.moveTo(targetEntity, speedModifier);              // 追蹤實體

// 停止移動
nav.stop();

// 檢查是否在移動
boolean moving = !nav.isDone();

// 強制重新規劃（每 N tick 呼叫一次即可，不用每 tick）
nav.recomputePath();
```

---

## 朝向控制 / Look Control

```java
import net.minecraft.world.entity.ai.control.LookControl;

LookControl look = mob.getLookControl();

look.setLookAt(targetEntity, yRotSpeed, xRotSpeed); // 速度單位：度/tick
look.setLookAt(x, y, z);
```

---

## Attribute 屬性常數

完整常數在 `net.minecraft.world.entity.ai.attributes.Attributes`：

| 常數名 | 說明 | 預設值範圍 |
|--------|------|-----------|
| `MAX_HEALTH` | 最大生命值 | 0 – 1024 |
| `ATTACK_DAMAGE` | 攻擊傷害 | 0 – 2048 |
| `ATTACK_SPEED` | 攻擊速度 | 0 – 1024 |
| `ATTACK_KNOCKBACK` | 攻擊擊退力 | 0 – 5 |
| `MOVEMENT_SPEED` | 移動速度（基礎值） | 0 – 1024 |
| `FLYING_SPEED` | 飛行速度 | 0 – 1024 |
| `ARMOR` | 防具值 | 0 – 30 |
| `ARMOR_TOUGHNESS` | 防具韌性 | 0 – 20 |
| `KNOCKBACK_RESISTANCE` | 擊退抵抗（1.0=完全免疫） | 0 – 1 |
| `FOLLOW_RANGE` | 追蹤/感知範圍 | 0 – 2048 |
| `SPAWN_REINFORCEMENTS_CHANCE` | 喚援機率（Zombie） | 0 – 1 |
| `MAX_ABSORPTION` | 吸收效果上限 | 0 – 2048 |
| `LUCK` | 幸運值 | -1024 – 1024 |

### 設定屬性

```java
import net.minecraft.world.entity.ai.attributes.Attributes;

// 修改現有實體屬性
Objects.requireNonNull(mob.getAttribute(Attributes.MAX_HEALTH)).setBaseValue(100.0);
mob.setHealth(100.0f); // 同時設定當前血量

// 建構時設定（自定義實體）
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

## EntityType 常數速查

`net.minecraft.world.entity.EntityTypes`（26.x 起原版常數由 `EntityType` 移至 `EntityTypes`，型別仍為 `EntityType<?>`）— 常用值：

| 常數 | 實體 | 對應 Bukkit |
|------|------|------------|
| `EntityTypes.ZOMBIE` | 殭屍 | `EntityType.ZOMBIE` |
| `EntityTypes.SKELETON` | 骷髏 | `EntityType.SKELETON` |
| `EntityTypes.CREEPER` | 苦力怕 | `EntityType.CREEPER` |
| `EntityTypes.ENDERMAN` | 末影人 | `EntityType.ENDERMAN` |
| `EntityTypes.SPIDER` | 蜘蛛 | `EntityType.SPIDER` |
| `EntityTypes.IRON_GOLEM` | 鐵傀儡 | `EntityType.IRON_GOLEM` |
| `EntityTypes.VILLAGER` | 村民 | `EntityType.VILLAGER` |
| `EntityTypes.WITHER` | 凋靈 | `EntityType.WITHER` |
| `EntityTypes.ARMOR_STAND` | 盔甲架 | `EntityType.ARMOR_STAND` |
| `EntityTypes.ITEM` | 掉落物 | `EntityType.ITEM` |
| `EntityTypes.EXPERIENCE_ORB` | 經驗球 | `EntityType.EXPERIENCE_ORB` |
| `EntityTypes.FIREBALL` | 火球 | `EntityType.FIREBALL` |
| `EntityTypes.ARROW` | 箭 | `EntityType.ARROW` |

---

## SpawnReason 對照

| NMS `MobSpawnType`（1.21.2+ 改名 `EntitySpawnReason`） | Bukkit `SpawnReason` | 說明 |
|--------------------|---------------------|------|
| `NATURAL` | `NATURAL` | 自然生成 |
| `CHUNK_GENERATION` | `CHUNK_GEN` | 區塊生成 |
| `SPAWNER` | `SPAWNER` | 刷怪籠 |
| `COMMAND` | `COMMAND` | 指令 `/summon` |
| `SPAWN_EGG` | `SPAWN_EGG` | 刷怪蛋 |
| `REINFORCEMENT` | `REINFORCEMENTS` | 援兵（Zombie）|
| `TRIGGERED` | `BUILD_SNOWMAN` / `BUILD_IRONGOLEM` | 特殊建造 |

插件自定義生成建議用 Bukkit 的 `CreatureSpawnEvent.SpawnReason.CUSTOM`：
```java
level.addFreshEntity(mob, CreatureSpawnEvent.SpawnReason.CUSTOM);
```

---

## 實體生成與移除

```java
// 生成
ServerLevel level = ((CraftWorld) world).getHandle();
mob.snapTo(x, y, z, yaw, pitch); // 26.x：Entity.moveTo() 改名為 snapTo()
level.addFreshEntity(mob, CreatureSpawnEvent.SpawnReason.CUSTOM);

// 標記持久化（不因 chunk 卸載消失）
mob.setPersistenceRequired(true);

// 移除
mob.discard(); // 立即移除（不觸發 Death 事件）
mob.kill();    // 觸發 Death 事件
```

---

## 相關技能

- `Skills/nms/nms-custom-entity/SKILL.md` — 自定義實體與 AI
- `docs/paper-nms/bukkit-nms-bridge.md` — Bukkit ↔ NMS 橋接
- `Skills/_shared/nms-threading.md` — 執行緒規則（實體操作必須在主執行緒）
