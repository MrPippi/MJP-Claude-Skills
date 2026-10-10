<!-- Generated from Skills/_shared/nms-obfuscation.md by scripts/sync-skill-references.mjs. Do not edit; change the source and re-run the script. -->

# NMS Obfuscation & Mojang Mappings / NMS 混淆與 Mojang 映射

Explains the naming systems for Paper NMS development. **Since Minecraft 26.1, Mojang no longer obfuscates Java Edition**, and the server jar uses official names directly;
this project always uses official Mojang names (via Paperweight userdev) and does not support Spigot/obfuscated mappings.

---

## Mappings Comparison

| Mappings | Example class name | Example method name | Purpose |
|------|----------|-----------|------|
| **Mojang (official)** | `net.minecraft.server.level.ServerPlayer` | `connection.send(packet)` | Readable during development |
| **Spigot (historical)** | `net.minecraft.server.v1_21_R1.EntityPlayer` | `b.a(packet)` | Obsolete; plugins using Spigot names cannot run on 26.x |
| **Intermediary (Fabric)** | `class_3222` | `method_14369` | Fabric only |

Paper 1.20.5+ server runtime already uses Mojang names; since 26.1 vanilla itself is no longer obfuscated. Plugins produced by Paperweight **need no remap** and work directly once deployed.

---

## Paperweight userdev Essentials

The `io.papermc.paperweight.userdev` Gradle plugin provides:

1. **`paperweight.paperDevBundle(version)`** — exposes Paper + NMS API in Mojang-mapped form
2. **No `reobfJar` needed** — 26.x has no obfuscation to reverse; use the `assemble` / `shadowJar` output directly
3. **Automatic download** of the Paper Dev Bundle (including full NMS sources)

```gradle
plugins {
    id 'java'
    id 'io.papermc.paperweight.userdev' version '2.0.0-beta.24'
}

dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(25)
}
```

---

## Package Naming Reference

| Layer | Mojang name | Typical contents |
|------|------------|---------|
| Player | `net.minecraft.server.level.ServerPlayer` | The NMS player itself |
| World | `net.minecraft.server.level.ServerLevel` | NMS world |
| Connection | `net.minecraft.server.network.ServerGamePacketListenerImpl` | Player network connection |
| Packet base | `net.minecraft.network.protocol.Packet<?>` | Supertype of all packets |
| Clientbound packets | `net.minecraft.network.protocol.game.Clientbound*` | Server → client |
| Serverbound packets | `net.minecraft.network.protocol.game.Serverbound*` | Client → server |
| Entity | `net.minecraft.world.entity.Entity` | Base class of all entities |
| Item | `net.minecraft.world.item.ItemStack` (NMS version) | Different from Bukkit `ItemStack` |

---

## Bukkit ↔ NMS Bridge

```java
import org.bukkit.craftbukkit.CraftWorld;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

// Bukkit Player → NMS ServerPlayer
ServerPlayer nmsPlayer = ((CraftPlayer) bukkitPlayer).getHandle();

// Bukkit World → NMS ServerLevel
ServerLevel nmsLevel = ((CraftWorld) bukkitWorld).getHandle();

// Bukkit ItemStack → NMS ItemStack
net.minecraft.world.item.ItemStack nmsItem =
    org.bukkit.craftbukkit.inventory.CraftItemStack.asNMSCopy(bukkitItem);
```

> Paper 1.20.5+ removed CraftBukkit's version-number relocation, so the package is always `org.bukkit.craftbukkit` (no `v1_21_R1` suffix); `v1_xx_Rx` only exists on Spigot and Paper 1.20.4 and earlier.
> If the plugin must also support Spigot or Paper 1.20.4 and earlier, use the `nms-reflection-bridge` skill to obtain the package name dynamically.

---

## API Location Stability

| Stability | API location | Upgrade strategy |
|--------|----------|---------|
| 🟢 High | `net.minecraft.world.*`, `.server.level.*` | Direct upgrade is usually fine |
| 🟡 Medium | `.network.protocol.game.*` (packets) | New versions often change field names / record structure |
| 🔴 Low | `.server.MinecraftServer` private fields | Field visibility may change in every version |
| 🟢 High (Paper 1.20.5+) | `org.bukkit.craftbukkit.*` | No longer versioned; Spigot / older Paper use `org.bukkit.craftbukkit.v1_xx_Rx.*` |

---

## Why Not ReflectionRemapper?

Historically (1.20.4 and earlier), Paper plugins needed the `ReflectionRemapper` API to convert Mojang names to the runtime Spigot names. **Starting with 1.20.5 the Paper runtime natively uses Mojang mappings**, so:

- ✅ Writing Mojang names means writing runtime names
- ✅ `Class.forName("net.minecraft.server.level.ServerPlayer")` works directly
- ❌ No need for a `PaperLib.getMinecraftVersion()` remap branch

---

## Tracking Cross-Version Changes

When upgrading the NMS version, check in this order:

1. **Paperweight changelog** — https://github.com/PaperMC/Paper/blob/master/build-data/paper.yml
2. **NMS diff** — compare the sources of different versions under `~/.gradle/caches/paperweight/` in your IDE
3. **Mojang obfuscation maps** — only needed for 1.21.11 and earlier; since 26.1 vanilla is unobfuscated and mappings are no longer provided
4. **Paper MiscChangeLog** — https://papermc.io/downloads/paper

---

## Related Skills

- `nms-reflection-bridge` — reflection strategy when Spigot / older versions (`v1_xx_Rx` packages) must be supported
- `nms-version-adapter` — multi-version adapter implementation
