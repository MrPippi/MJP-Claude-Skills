---
name: nms-particle-effect
description: "透過 ClientboundLevelParticlesPacket 實現進階 NMS 粒子效果：客戶端專屬、大量粒子、自定義參數（Paper NMS + Mojang-mapped）/ Advanced NMS particle effects via ClientboundLevelParticlesPacket with per-client and bulk support"
---

# NMS Particle Effect / NMS 進階粒子效果

## 技能名稱 / Skill Name

`nms-particle-effect`

## 目的 / Purpose

透過 `ClientboundLevelParticlesPacket` 直接發送 NMS 粒子封包，實現 Bukkit `World.spawnParticle()` 無法達到的效果：客戶端專屬粒子（只對特定玩家顯示）、超大量粒子、精確的速度/偏移控制、Item/Block 參數粒子。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21 – 1.21.3
- Paperweight userdev 1.7.2+
- Mojang mappings（已由 Paper 1.20.5+ 原生支援）

## 觸發條件 / Triggers

- 「粒子效果」「particle effect」「LevelParticles」「NMS 粒子」「custom particle」
- 「客戶端粒子」「client particle」「per-player particle」「私有粒子」
- 「大量粒子」「bulk particle」「particle packet」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.effect` | 產出類別所在 package |
| `class_name` | `ParticleEffect` | 效果工具類名稱 |
| `include_shapes` | `true` | 是否產生預設形狀（圓形、線段、螺旋） |

## 輸出產物 / Outputs

- `ParticleEffect.java` — 粒子封包發送工具
- `ParticleBuilder.java` — 粒子封包 Builder 模式封裝
- `ParticleShapes.java`（選）— 預設形狀（circle、line、helix）

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}
```

## 代碼範本 / Code Template

### `ParticleEffect.java`

```java
package com.example.effect;

import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.particles.SimpleParticleType;
import net.minecraft.network.protocol.game.ClientboundLevelParticlesPacket;
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.Location;
import org.bukkit.craftbukkit.v1_21_R1.entity.CraftPlayer;
import org.bukkit.entity.Player;

import java.util.Collection;

@SuppressWarnings("UnstableApiUsage")
public final class ParticleEffect {

    private ParticleEffect() {}

    /**
     * 發送粒子封包給單一玩家（客戶端專屬）。
     *
     * @param particle  NMS ParticleOptions（如 ParticleTypes.FLAME）
     * @param loc       粒子位置
     * @param count     粒子數量
     * @param offsetX/Y/Z 隨機偏移範圍
     * @param speed     粒子速度（0 = 不移動）
     * @param override  true = 強制顯示（無視客戶端粒子設定）
     */
    public static void send(Player player, ParticleOptions particle, Location loc,
                            int count, double offsetX, double offsetY, double offsetZ,
                            double speed, boolean override) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        ClientboundLevelParticlesPacket packet = new ClientboundLevelParticlesPacket(
            particle, override,
            loc.getX(), loc.getY(), loc.getZ(),
            (float) offsetX, (float) offsetY, (float) offsetZ,
            (float) speed, count
        );
        nms.connection.send(packet);
    }

    /** 對一組玩家發送同一粒子封包。 */
    public static void sendAll(Collection<? extends Player> players, ParticleOptions particle,
                               Location loc, int count, double offsetX, double offsetY,
                               double offsetZ, double speed) {
        ClientboundLevelParticlesPacket packet = new ClientboundLevelParticlesPacket(
            particle, false,
            loc.getX(), loc.getY(), loc.getZ(),
            (float) offsetX, (float) offsetY, (float) offsetZ,
            (float) speed, count
        );
        for (Player p : players) {
            ((CraftPlayer) p).getHandle().connection.send(packet);
        }
    }

    /** 常用快捷方法：在指定位置爆炸粒子。 */
    public static void explosion(Player player, Location loc) {
        send(player, ParticleTypes.EXPLOSION, loc, 1, 0, 0, 0, 0, true);
    }

    /** 常用快捷方法：心形粒子。 */
    public static void hearts(Player player, Location loc, int count) {
        send(player, ParticleTypes.HEART, loc, count, 0.5, 0.5, 0.5, 0, false);
    }

    /** 常用快捷方法：火焰粒子向上噴。 */
    public static void flame(Player player, Location loc, int count) {
        send(player, ParticleTypes.FLAME, loc, count, 0.1, 0.3, 0.1, 0.05f, false);
    }
}
```

### `ParticleBuilder.java`（Builder 模式）

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

### `ParticleShapes.java`（預設形狀）

```java
package com.example.effect;

import net.minecraft.core.particles.ParticleOptions;
import org.bukkit.Location;
import org.bukkit.entity.Player;

@SuppressWarnings("UnstableApiUsage")
public final class ParticleShapes {

    private ParticleShapes() {}

    /** 在指定位置畫一個水平圓（count 點均分）。 */
    public static void circle(Player player, Location center, double radius,
                              int points, ParticleOptions particle) {
        for (int i = 0; i < points; i++) {
            double angle = 2 * Math.PI * i / points;
            Location loc = center.clone().add(
                radius * Math.cos(angle), 0, radius * Math.sin(angle));
            ParticleEffect.send(player, particle, loc, 1, 0, 0, 0, 0, false);
        }
    }

    /** 從 start 到 end 畫一條粒子線段（density 控制點密度）。 */
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

    /** 往上螺旋粒子（height 高度、loops 圈數、points 每圈點數）。 */
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

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── effect/
    ├── ParticleEffect.java
    ├── ParticleBuilder.java
    └── ParticleShapes.java
```

## 執行緒安全注意事項 / Thread Safety

- ✅ `ParticleEffect.send()` 內部呼叫 `connection.send()`，**可在任何執行緒呼叫**
- ⚠️ Location 若依賴世界狀態（如跟隨實體），封包建構須在主執行緒完成
- ⚠️ `ParticleShapes` 中的 `start.distance(end)` 需要兩個 Location 同屬一個世界
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 粒子不顯示 | 客戶端粒子設定為「最少」 | 設 `override = true` 強制顯示 |
| 粒子只顯示在遠端 | offset 過大 | 減小 offsetX/Y/Z |
| Item 粒子不顯示 | 需使用 `ItemParticleOption` 而非 `SimpleParticleType` | 改用 `new ItemParticleOption(ParticleTypes.ITEM, nmsItemStack)` |
| Block 粒子不顯示 | 需使用 `BlockParticleOption` | 改用 `new BlockParticleOption(ParticleTypes.BLOCK, blockState)` |
