---
name: nms-version-adapter
description: "多版本 NMS 相容性 Adapter 模式：抽象介面 + 版本特定實作 + runtime dispatch，讓同一 plugin 支援多個 MC 版本 / Multi-version NMS compatibility adapter pattern"
---

# NMS Version Adapter

## Skill Name

`nms-version-adapter`

## Purpose

Define an abstract Adapter interface for common NMS operations, provide a concrete implementation for each supported MC version, and automatically pick the correct adapter at runtime based on the server version. Suited to commercial or large plugins that must ship for multiple versions.

## NMS Version Requirements

- Supported range: Paper 1.21.11 / 26.x (the examples show two adapters, 26.2 and 26.3; a 1.21.11 adapter is written the same way, with the dev bundle changed to `1.21.11-R0.1-SNAPSHOT` and Java 21)
- Recommended together with `nms-reflection-bridge` or a multi-module Gradle build
- Adapter implementations may use Paperweight (requires multi-module) or pure reflection

## Triggers

- "version adapter", "版本適配器", "multi-version"
- "多版本相容", "跨版本 NMS", "backwards compatibility"
- "adapter pattern NMS"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.nms` | Package of the generated classes |
| `adapter_interface` | `NmsAdapter` | Abstract interface name |
| `supported_versions` | `26.2, 26.3` | List of MC versions to support |

## Outputs

- `NmsAdapter.java` — common abstract interface
- `AdapterRegistry.java` — version detection and adapter selector
- `V26_2_Adapter.java` — Paper 26.2 implementation
- `V26_3_Adapter.java` — Paper 26.3 implementation
- `NmsVersion.java` — version enum

## Build Setup

Use a **multi-module Gradle build**, with each version compiled in its own module:

```
my-plugin/
├── build.gradle
├── core/                  # version-independent logic + NmsAdapter interface
├── adapter-v26_2/         # compiled against the 26.2 dev bundle
├── adapter-v26_3/       # compiled against the 26.3 dev bundle
└── plugin/                # integrates and packages all adapters
```

## Code Template

### `NmsVersion.java`

```java
package com.example.nms;

import org.bukkit.Bukkit;

public enum NmsVersion {
    V26_1,
    V26_2,
    V26_3,
    UNSUPPORTED;

    public static NmsVersion detect() {
        // From 26.x the version is "year.drop[.hotfix]", e.g. "26.2", "26.1.2"; match on the first two segments
        String[] parts = Bukkit.getMinecraftVersion().split("\\.");
        String majorMinor = parts.length >= 2 ? parts[0] + "." + parts[1] : parts[0];
        return switch (majorMinor) {
            case "26.1" -> V26_1;
            case "26.2" -> V26_2;
            case "26.3" -> V26_3;
            default -> UNSUPPORTED;
        };
    }
}
```

### `NmsAdapter.java`

```java
package com.example.nms;

import org.bukkit.entity.Player;
import org.bukkit.Location;
import net.kyori.adventure.text.Component;

/**
 * Cross-version NMS operation interface. Every method must give equivalent results on all supported versions.
 */
public interface NmsAdapter {

    /** Returns the MC version this adapter supports. */
    NmsVersion version();

    /** Sends action bar text. */
    void sendActionBar(Player player, Component message);

    /** Gets the player's network latency (ms). */
    int getLatency(Player player);

    /** Spawns a particle at the given location (client-only, fires no event). */
    void spawnParticleClient(Location loc, String particleKey, int count);

    /** Ticks an entity directly (for forced updates). */
    void forceTickEntity(org.bukkit.entity.Entity entity);
}
```

### `AdapterRegistry.java`

```java
package com.example.nms;

import java.util.EnumMap;
import java.util.Map;

public final class AdapterRegistry {

    private static final Map<NmsVersion, NmsAdapter> ADAPTERS = new EnumMap<>(NmsVersion.class);
    private static NmsAdapter active;

    private AdapterRegistry() {}

    public static void register(NmsAdapter adapter) {
        ADAPTERS.put(adapter.version(), adapter);
    }

    /** Called in the plugin's onEnable; automatically selects the adapter for the current version. */
    public static void initialize() {
        NmsVersion detected = NmsVersion.detect();
        if (detected == NmsVersion.UNSUPPORTED) {
            throw new IllegalStateException(
                "Unsupported MC version: " + org.bukkit.Bukkit.getMinecraftVersion());
        }
        active = ADAPTERS.get(detected);
        if (active == null) {
            throw new IllegalStateException(
                "No adapter registered for version: " + detected);
        }
    }

    /** Gets the adapter for the current runtime environment. */
    public static NmsAdapter get() {
        if (active == null) throw new IllegalStateException("AdapterRegistry not initialized");
        return active;
    }
}
```

### `V26_2_Adapter.java` (example implementation)

```java
package com.example.nms.v26_2;

import com.example.nms.NmsAdapter;
import com.example.nms.NmsVersion;
import io.papermc.paper.adventure.PaperAdventure;
import net.kyori.adventure.text.Component;
import net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket;
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;
import org.bukkit.Location;

@SuppressWarnings("UnstableApiUsage")
public class V26_2_Adapter implements NmsAdapter {

    @Override
    public NmsVersion version() {
        return NmsVersion.V26_2;
    }

    @Override
    public void sendActionBar(Player player, Component message) {
        ClientboundSetActionBarTextPacket packet =
            new ClientboundSetActionBarTextPacket(PaperAdventure.asVanilla(message));
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        if (nms.connection != null) nms.connection.send(packet);
    }

    @Override
    public int getLatency(Player player) {
        return ((CraftPlayer) player).getHandle().connection.latency();
    }

    @Override
    public void spawnParticleClient(Location loc, String particleKey, int count) {
        // 26.2 implementation: uses ClientboundLevelParticlesPacket
        // ...
    }

    @Override
    public void forceTickEntity(org.bukkit.entity.Entity entity) {
        // 26.2 implementation
        // ...
    }
}
```

### Initialization (`MyNmsPlugin.onEnable`)

```java
@Override
public void onEnable() {
    AdapterRegistry.register(new V26_2_Adapter());
    AdapterRegistry.register(new V26_3_Adapter());
    AdapterRegistry.initialize();

    getLogger().info("Using NMS adapter: " + AdapterRegistry.get().version());
}
```

### Usage

```java
// Version-independent business logic
public void sendWelcome(Player player) {
    AdapterRegistry.get().sendActionBar(player, Component.text("Welcome!"));
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── nms/
    ├── NmsAdapter.java
    ├── NmsVersion.java
    ├── AdapterRegistry.java
    └── v26_2/
        └── V26_2_Adapter.java
    └── v26_3/
        └── V26_3_Adapter.java
```

## Thread Safety

- ✅ `AdapterRegistry` is immutable after a single initialization, so reads are thread-safe
- ⚠️ Concrete adapter methods still follow the NMS threading rules (see [`references/nms-threading.md`](references/nms-threading.md))
- ⚠️ `AdapterRegistry.register()` should be called only once in `onEnable()` to avoid race conditions
- ⚠️ With a multi-module build, adapter modules must not reference each other

## Fallback

| Error | Cause | Solution |
|------|------|------|
| `IllegalStateException: Unsupported MC version` | Started on an unsupported version | Add a fallback branch in `NmsVersion.detect()` (try the closest version) |
| `ClassNotFoundException` / `NoClassDefFoundError` | A NMS class referenced by the adapter does not exist in the current version | Wrap `register()` in try-catch and skip registering that adapter on failure |
| `AbstractMethodError` | A method was added to the adapter interface but an old adapter does not implement it | Give the interface method a `default` implementation |
| Multi-module packaging omission | shadowJar does not include the adapter module | Add to `plugin/build.gradle`: `shadow project(':adapter-v26_2')` |
| NMS signature differences between versions | A method was removed or renamed in the newer version | Branch by version inside the adapter using reflection (combine with `nms-reflection-bridge`) |
