---
id: nms-custom-entity
title: NMS Custom Entity
titleZh: NMS 自定義實體
description: Extend NMS Mob classes and override registerGoals() to add custom PathfinderGoal AI behavior for bosses, NPCs, or guards.
descriptionZh: 繼承 NMS Mob 類別並覆寫 registerGoals()，加入自訂 PathfinderGoal 實現 Boss、NPC 或守衛的 AI 行為。
version: "1.0.0"
status: active
category: nms-entity
categoryLabel: NMS 實體
categoryLabelEn: NMS Entity
tags: [nms, entity, ai, pathfinder, mob, boss, paperweight]
triggerKeywords:
  - "自定義實體"
  - "custom entity"
  - "NMS AI"
  - "PathfinderGoal"
  - "自訂 mob"
  - "custom mob"
  - "entity goal"
updatedAt: "2026-04-19"
githubPath: Skills/nms/nms-custom-entity/SKILL.md
featured: true
---

# NMS Custom Entity

## 目的

透過繼承 NMS Mob 類別並覆寫 `registerGoals()` 加入自訂 `PathfinderGoal`，實現自定義 AI 行為。適用於客製化 Boss、NPC、守衛等場景。

---

## 平台需求

- Paper 26.2
- Paperweight userdev 2.0.0-beta.24+
- `paper-plugin.yml`（確保 NMS 早於 Bukkit plugin 載入）

---

## 產生的代碼

### CustomZombie.java

```java
import net.minecraft.world.entity.monster.zombie.Zombie; // 26.x 起位於 monster.zombie 子套件

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

### FollowClosestPlayerGoal.java（自訂 PathfinderGoal）

```java
public class FollowClosestPlayerGoal extends Goal {
    @Override public boolean canUse() { /* 找最近玩家 */ }
    @Override public void start() { mob.getNavigation().moveTo(target, speed); }
    @Override public void tick() { /* 每 10 tick 重新規劃路徑 */ }
}
```

---

## 執行緒安全

- 實體建立、`addFreshEntity()` 必須在主執行緒
- `PathfinderGoal.tick()` 由 NMS tick 迴圈在主執行緒呼叫
