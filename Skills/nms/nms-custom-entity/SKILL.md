---
name: nms-custom-entity
description: "建立自定義 NMS 實體：繼承現有 Mob 類別、自訂 PathfinderGoal、替換 vanilla 實體行為 / Create custom NMS entities with custom PathfinderGoal AI"
---

# NMS Custom Entity / NMS 自定義實體

## 技能名稱 / Skill Name

`nms-custom-entity`

## 目的 / Purpose

透過繼承 NMS Mob 類別並覆寫 `registerGoals()` 加入自訂 `PathfinderGoal`，實現自定義 AI 行為。適用於客製化 Boss、NPC、守衛等場景。

### 相關技能 / Related

- 需要「玩家外觀」且行為與真玩家一致（暴擊、舉盾、擊退）的機器人 → [`nms-fake-player`](../nms-fake-player/SKILL.md)
- 生物只需調整屬性或 AI 目標時，先考慮 Paper API（`Mob#getPathfinder`、`Attribute`），再考慮 NMS

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev 2.0.0-beta.24+
- 須使用 `paper-plugin.yml`（確保早於 Bukkit plugin 載入）

## 觸發條件 / Triggers

- 「自定義實體」「custom entity」「NMS AI」
- 「PathfinderGoal」「自訂 mob」「custom mob」
- 「entity goal」「custom zombie」「replace entity」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.entities` | 產出類別所在 package |
| `entity_class_name` | `CustomZombie` | 自定義實體類名 |
| `base_entity` | `Zombie` | 繼承的 NMS 基類 |
| `entity_id` | `my_custom_zombie` | 註冊用 ID（namespaced） |
| `goal_class_name` | `FollowClosestPlayerGoal` | 自訂 goal 類名 |

## 輸出產物 / Outputs

- `CustomZombie.java` — 繼承 `net.minecraft.world.entity.monster.zombie.Zombie` 的自定義實體
- `FollowClosestPlayerGoal.java` — 自訂 `PathfinderGoal` 範本
- `EntitySpawner.java` — 生成工具類
- `EntityListener.java`（選）— 攔截 vanilla spawn 替換為自定義實體

## Paperweight 建置設定 / Build Setup

參見 [`references/paper-nms-platform.md`](references/paper-nms-platform.md)。

## 代碼範本 / Code Template

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
        // 游泳（必備）
        this.goalSelector.addGoal(0, new FloatGoal(this));

        // 自訂：鎖定最近的玩家
        this.goalSelector.addGoal(1, new FollowClosestPlayerGoal(this, 1.2D, 32.0D));

        // 近戰攻擊（速度倍率 1.0，追擊時不鬆手）
        this.goalSelector.addGoal(2, new MeleeAttackGoal(this, 1.0D, false));

        // 隨機觀察周圍
        this.goalSelector.addGoal(8, new LookAtPlayerGoal(this, Player.class, 8.0F));
        this.goalSelector.addGoal(8, new RandomLookAroundGoal(this));

        // 目標選擇器：玩家優先
        this.targetSelector.addGoal(1, new NearestAttackableTargetGoal<>(this, Player.class, true));
    }

    /** 自訂屬性：更高的血量與攻擊。 */
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
        // 每 10 tick 重新規劃路徑
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
     * 在指定位置生成自定義殭屍。必須在主執行緒呼叫。
     */
    public static org.bukkit.entity.Entity spawnCustomZombie(Location loc) {
        ServerLevel level = ((CraftWorld) loc.getWorld()).getHandle();

        // 26.x：原版 EntityType 常數移至 EntityTypes（1.21.11 仍在 EntityType）
        CustomZombie zombie = new CustomZombie(EntityTypes.ZOMBIE, level); // @1.21.11: CustomZombie zombie = new CustomZombie(EntityType.ZOMBIE, level);
        zombie.snapTo(loc.getX(), loc.getY(), loc.getZ(), loc.getYaw(), loc.getPitch());

        // 設定自訂名稱（顯示在頭上）
        zombie.setCustomName(net.minecraft.network.chat.Component.literal("§c自訂殭屍"));
        zombie.setCustomNameVisible(true);

        level.addFreshEntity(zombie, org.bukkit.event.entity.CreatureSpawnEvent.SpawnReason.CUSTOM);
        return zombie.getBukkitEntity();
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── entities/
    ├── CustomZombie.java
    ├── FollowClosestPlayerGoal.java
    ├── EntitySpawner.java
    └── EntityListener.java
```

## 執行緒安全注意事項 / Thread Safety

- ⚠️ 實體建立、`addFreshEntity()`、`snapTo()` **必須在主執行緒**
- ⚠️ `PathfinderGoal.tick()` 由 NMS 在主執行緒的 tick 迴圈呼叫，勿做耗時操作
- ⚠️ 存取 `mob.level()` 時確認 chunk 已載入
- ✅ 可在 async 預計算路徑資料，但 `Navigation.moveTo()` 必須在主執行緒呼叫
- 詳見 [`references/nms-threading.md`](references/nms-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 實體不動 | `Goal.canUse()` 未回傳 true | 加 log 檢查 target 是否被過濾掉 |
| Chunk 卸載後實體消失 | 未標記 persistent | `zombie.setPersistenceRequired()` |
| 屬性無效 | 未呼叫 `createAttributes()` 註冊 | Paper 自定義實體需透過 `EntityType.Builder` 註冊（或繼承現有 Type） |
| 客戶端顯示空白實體 | Entity type 不存在於客戶端 | 繼承 vanilla 類型（如 `Zombie`）而非建立新 `EntityType` |
| `UnsupportedOperationException` 在 `registerGoals` | Goal 被重複加入 | 清空 `goalSelector` 再重建：`goalSelector.removeAllGoals(g -> true)` |
