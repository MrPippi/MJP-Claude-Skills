---
id: nms-particle-effect
title: NMS Particle Effect
titleZh: NMS 進階粒子效果
description: Advanced NMS particle effects via ClientboundLevelParticlesPacket with per-client and bulk support on Paper 1.21.x with Mojang mappings.
descriptionZh: 透過 ClientboundLevelParticlesPacket 實現進階 NMS 粒子效果：客戶端專屬、大量粒子、自定義參數（Paper NMS + Mojang mappings）。
version: "1.0.0"
status: active
category: nms-world
categoryLabel: NMS 世界
categoryLabelEn: NMS World
tags: [nms, particle, effect, levelparticles, visual, mojang-mapped]
triggerKeywords:
  - "粒子效果"
  - "particle effect"
  - "LevelParticles"
  - "NMS 粒子"
  - "custom particle"
  - "客戶端粒子"
  - "per-player particle"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-particle-effect/SKILL.md
featured: false
---

# NMS Particle Effect

## 目的

透過 `ClientboundLevelParticlesPacket` 直接發送 NMS 粒子封包，實現 Bukkit `World.spawnParticle()` 無法達到的效果：客戶端專屬粒子、超大量粒子、精確速度/偏移控制。

---

## 平台需求

- Paper 1.21 – 1.21.3
- Paperweight userdev 2.0.0-beta.24+
- Mojang mappings（Paper 1.20.5+ 原生支援）
- Java 21

---

## 產生的代碼

### ParticleEffect.java

```java
// 發送客戶端專屬粒子
ParticleEffect.send(player, ParticleTypes.FLAME, loc, 10, 0.1, 0.3, 0.1, 0.05f, false);

// Builder 模式廣播
new ParticleBuilder()
    .particle(ParticleTypes.ENCHANT)
    .at(center).count(50).receivers(world.getPlayers())
    .spawn();
```

### ParticleShapes.java（預設形狀）

```java
ParticleShapes.circle(player, center, 2.0, 36, ParticleTypes.ENCHANT);
ParticleShapes.helix(player, base, 0.5, 3.0, 3, 16, ParticleTypes.SOUL);
```

---

## 執行緒安全

- `ParticleEffect.send()` 可在任意執行緒呼叫
- Location 若依賴世界狀態，封包建構須在主執行緒完成
