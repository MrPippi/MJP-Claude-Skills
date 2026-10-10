---
name: nms-particle-effect
description: "透過 ClientboundLevelParticlesPacket 實現進階 NMS 粒子效果：客戶端專屬、大量粒子、自定義參數（Paper NMS + Mojang-mapped）/ Advanced NMS particle effects via ClientboundLevelParticlesPacket with per-client and bulk support"
---

# NMS Particle Effect

## Skill Name

`nms-particle-effect`

## Purpose

Send NMS particle packets directly via `ClientboundLevelParticlesPacket` to achieve effects Bukkit `World.spawnParticle()` cannot: client-specific particles (shown only to selected players), very large particle counts, precise speed/offset control, and Item/Block parameterized particles.

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- 「粒子效果」「particle effect」「LevelParticles」「NMS 粒子」「custom particle」
- 「客戶端粒子」「client particle」「per-player particle」「私有粒子」
- 「大量粒子」「bulk particle」「particle packet」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.effect` | Package of the generated classes |
| `class_name` | `ParticleEffect` | Effect utility class name |
| `include_shapes` | `true` | Whether to generate default shapes (circle, line, helix) |

## Outputs

- `ParticleEffect.java` — particle packet sending utility
- `ParticleBuilder.java` — Builder-pattern wrapper for particle packets
- `ParticleShapes.java`(optional) — default shapes (circle, line, helix)

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `ParticleEffect.java`

```java
package com.example.effect;

import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.particles.SimpleParticleType;
import net.minecraft.network.protocol.game.ClientboundLevelParticlesPacket;
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.Location;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

import java.util.Collection;

@SuppressWarnings("UnstableApiUsage")
public final class ParticleEffect {

    private ParticleEffect() {}

    /**
     * Sends a particle packet to a single player (client-specific).
     *
     * @param particle  NMS ParticleOptions (e.g. ParticleTypes.FLAME)
     * @param loc       particle location
     * @param count     particle count
     * @param offsetX/Y/Z random offset range
     * @param speed     particle speed (0 = no movement)
     * @param override  true = force display: overrideLimiter (render at long range) + alwaysShow (ignore the client's "Particles: Decreased" setting)
     */
    public static void send(Player player, ParticleOptions particle, Location loc,
                            int count, double offsetX, double offsetY, double offsetZ,
                            double speed, boolean override) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        // 1.21.4+ constructor: (particle, overrideLimiter, alwaysShow, x, y, z, dx, dy, dz, speed, count)
        ClientboundLevelParticlesPacket packet = new ClientboundLevelParticlesPacket(
            particle, override, override,
            loc.getX(), loc.getY(), loc.getZ(),
            (float) offsetX, (float) offsetY, (float) offsetZ,
            (float) speed, count
        );
        nms.connection.send(packet);
    }

    /** Sends the same particle packet to a group of players. */
    public static void sendAll(Collection<? extends Player> players, ParticleOptions particle,
                               Location loc, int count, double offsetX, double offsetY,
                               double offsetZ, double speed) {
        ClientboundLevelParticlesPacket packet = new ClientboundLevelParticlesPacket(
            particle, false, false,
            loc.getX(), loc.getY(), loc.getZ(),
            (float) offsetX, (float) offsetY, (float) offsetZ,
            (float) speed, count
        );
        for (Player p : players) {
            ((CraftPlayer) p).getHandle().connection.send(packet);
        }
    }

    /** Common shortcut: explosion particle at the given location. */
    public static void explosion(Player player, Location loc) {
        send(player, ParticleTypes.EXPLOSION, loc, 1, 0, 0, 0, 0, true);
    }

    /** Common shortcut: heart particles. */
    public static void hearts(Player player, Location loc, int count) {
        send(player, ParticleTypes.HEART, loc, count, 0.5, 0.5, 0.5, 0, false);
    }

    /** Common shortcut: flame particles shooting upward. */
    public static void flame(Player player, Location loc, int count) {
        send(player, ParticleTypes.FLAME, loc, count, 0.1, 0.3, 0.1, 0.05f, false);
    }
}
```

### `ParticleBuilder.java` (Builder pattern)

```java
package com.example.effect;

import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import org.bukkit.Location;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@SuppressWarnings("UnstableApiUsage")
public class ParticleBuilder {

    private ParticleOptions particle = ParticleTypes.FLAME;
    private Location location;
    private int count = 1;
    private double offsetX = 0, offsetY = 0, offsetZ = 0;
    private double speed = 0;
    private boolean override = false;
    private final List<Player> receivers = new ArrayList<>();

    public ParticleBuilder particle(ParticleOptions particle) {
        this.particle = particle;
        return this;
    }

    public ParticleBuilder at(Location loc) {
        this.location = loc;
        return this;
    }

    public ParticleBuilder count(int count) {
        this.count = count;
        return this;
    }

    public ParticleBuilder offset(double x, double y, double z) {
        this.offsetX = x;
        this.offsetY = y;
        this.offsetZ = z;
        return this;
    }

    public ParticleBuilder speed(double speed) {
        this.speed = speed;
        return this;
    }

    public ParticleBuilder override(boolean override) {
        this.override = override;
        return this;
    }

    public ParticleBuilder receivers(Collection<? extends Player> players) {
        this.receivers.addAll(players);
        return this;
    }

    public ParticleBuilder receiver(Player player) {
        this.receivers.add(player);
        return this;
    }

    public void spawn() {
        if (location == null) throw new IllegalStateException("Location not set");
        ParticleEffect.sendAll(receivers, particle, location, count, offsetX, offsetY, offsetZ, speed);
    }
}
```

### `ParticleShapes.java` (default shapes)

```java
package com.example.effect;

import net.minecraft.core.particles.ParticleOptions;
import org.bukkit.Location;
import org.bukkit.entity.Player;

@SuppressWarnings("UnstableApiUsage")
public final class ParticleShapes {

    private ParticleShapes() {}

    /** Draws a horizontal circle at the given location (points evenly spaced). */
    public static void circle(Player player, Location center, double radius,
                              int points, ParticleOptions particle) {
        for (int i = 0; i < points; i++) {
            double angle = 2 * Math.PI * i / points;
            Location loc = center.clone().add(
                radius * Math.cos(angle), 0, radius * Math.sin(angle));
            ParticleEffect.send(player, particle, loc, 1, 0, 0, 0, 0, false);
        }
    }

    /** Draws a particle line from start to end (density controls point spacing). */
    public static void line(Player player, Location start, Location end,
                            double density, ParticleOptions particle) {
        double distance = start.distance(end);
        int steps = (int) (distance / density);
        double dx = (end.getX() - start.getX()) / steps;
        double dy = (end.getY() - start.getY()) / steps;
        double dz = (end.getZ() - start.getZ()) / steps;
        for (int i = 0; i <= steps; i++) {
            Location loc = start.clone().add(dx * i, dy * i, dz * i);
            ParticleEffect.send(player, particle, loc, 1, 0, 0, 0, 0, false);
        }
    }

    /** Upward spiral particles (height = total height, loops = number of turns, pointsPerLoop = points per turn). */
    public static void helix(Player player, Location base, double radius,
                             double height, int loops, int pointsPerLoop,
                             ParticleOptions particle) {
        int total = loops * pointsPerLoop;
        for (int i = 0; i < total; i++) {
            double angle = 2 * Math.PI * i / pointsPerLoop;
            double y = height * i / total;
            Location loc = base.clone().add(
                radius * Math.cos(angle), y, radius * Math.sin(angle));
            ParticleEffect.send(player, particle, loc, 1, 0, 0, 0, 0, false);
        }
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── effect/
    ├── ParticleEffect.java
    ├── ParticleBuilder.java
    └── ParticleShapes.java
```

## Thread Safety

- ✅ `ParticleEffect.send()` calls `connection.send()` internally, so it **can be called from any thread**
- ⚠️ If the Location depends on world state (e.g. following an entity), build the packet on the main thread
- ⚠️ `start.distance(end)` in `ParticleShapes` requires both Locations to be in the same world
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| Particles not shown | Client particle setting is "Minimal" | Set `override = true` to force display |
| Particles only appear far away | Offset too large | Reduce offsetX/Y/Z |
| Item particles not shown | Must use `ItemParticleOption` instead of `SimpleParticleType` | Use `new ItemParticleOption(ParticleTypes.ITEM, nmsItemStack)` |
| Block particles not shown | Must use `BlockParticleOption` | Use `new BlockParticleOption(ParticleTypes.BLOCK, blockState)` |
