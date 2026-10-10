# NMS Particle Effect

## Purpose

Send NMS particle packets directly through `ClientboundLevelParticlesPacket` to achieve what Bukkit `World.spawnParticle()` cannot: per-client particles, very large particle counts, and precise speed/offset control.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with trailing `// @1.21.11:` comments)
- Paperweight userdev 2.0.0-beta.24+
- Official Mojang names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### ParticleEffect.java

```java
// Send a per-client particle
ParticleEffect.send(player, ParticleTypes.FLAME, loc, 10, 0.1, 0.3, 0.1, 0.05f, false);

// Broadcast with the builder pattern
new ParticleBuilder()
    .particle(ParticleTypes.ENCHANT)
    .at(center).count(50).receivers(world.getPlayers())
    .spawn();
```

### ParticleShapes.java (preset shapes)

```java
ParticleShapes.circle(player, center, 2.0, 36, ParticleTypes.ENCHANT);
ParticleShapes.helix(player, base, 0.5, 3.0, 3, 16, ParticleTypes.SOUL);
```

---

## Thread Safety

- `ParticleEffect.send()` can be called from any thread
- If the Location depends on world state, build the packet on the main thread
