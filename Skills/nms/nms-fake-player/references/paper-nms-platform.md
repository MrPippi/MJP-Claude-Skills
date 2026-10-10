<!-- Generated from Skills/paper-nms/PLATFORM.md by scripts/sync-skill-references.mjs. Do not edit; change the source and re-run the script. -->

# Paper NMS Platform / Paper NMS 平台

This platform defines the base build setup for Paper NMS development, using Paperweight userdev and official Mojang names (vanilla has no longer been obfuscated since Minecraft 26.1). All code produced by the MJP-Paper-Skills NMS skills targets this platform by default.

- **MC versions**: **1.21.11** and **26.2** (both compile-verified; templates default to 26.2)
- **Java**: 1.21.11 → 21; 26.2 → 25 (minimum for Paper 26.x)
- **Build tool**: Gradle 8.11.2+ (Groovy DSL; 9.8.1 verified) — Paperweight 2.x does not support older Gradle
- **Naming**: official Mojang names (via Paperweight userdev 2.0.0-beta.24, pre-release)
- **Javadoc**: https://jd.papermc.io/paper/26.2/ | https://jd.papermc.io/paper/1.21.11/

### Version Difference Annotation Convention

Templates default to the 26.2 API. For a line that is written differently on 1.21.11, the replacement code is appended at the end of the line:

```text
CustomZombie zombie = new CustomZombie(EntityTypes.ZOMBIE, level); // @1.21.11: CustomZombie zombie = new CustomZombie(EntityType.ZOMBIE, level);
```

- When targeting 1.21.11, replace that line with the code after `// @1.21.11:`
- A code block that applies to a single version only starts with `// @only 26.2` or `// @only 1.21.11`
- The verification flow applies these substitutions and then compiles against both dev bundles separately

---

## 1. `build.gradle` Template

```groovy
plugins {
    id 'java'
    id 'io.papermc.paperweight.userdev' version '2.0.0-beta.24'
}

group = 'com.example'
version = '1.0.0'

repositories {
    mavenCentral()
    maven { url = 'https://repo.papermc.io/repository/maven-public/' }
}

dependencies {
    // Paperweight provides Mojang-mapped Paper + NMS API
    paperweight.paperDevBundle('26.2.build.132-stable')
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(25)
}

tasks {
    compileJava {
        options.encoding = 'UTF-8'
        options.release.set(25)
    }

    // Paper 1.20.5+ does not need reobfJar; use the assemble output directly (build/libs/*.jar)
    // If the shadow plugin is applied (id 'com.gradleup.shadow'), also add:
    //   assemble { dependsOn 'shadowJar' }
    // Declaring dependsOn 'shadowJar' without shadow applied makes assemble fail (Task 'shadowJar' not found)

    processResources {
        filteringCharset = 'UTF-8'
        filesMatching('paper-plugin.yml') {
            expand(
                name: project.name,
                version: project.version,
                description: project.description ?: ''
            )
        }
    }
}
```

**1.21.11 version**: change three places in the template above (verified with a real build)

| Item | 26.2 (default) | 1.21.11 |
|------|-------------|---------|
| `paperweight.paperDevBundle(...)` | `'26.2.build.132-stable'` | `'1.21.11-R0.1-SNAPSHOT'` |
| `JavaLanguageVersion.of(...)` / `options.release.set(...)` | `25` | `21` |
| `api-version` in `paper-plugin.yml` | `'26.2'` | `'1.21.11'` |

---

## 2. `settings.gradle` Template

```groovy
rootProject.name = 'my-nms-plugin'
```

---

## 3. `paper-plugin.yml` Template

```yaml
name: ${name}
version: '${version}'
main: com.example.MyNmsPlugin
api-version: '26.2'
description: '${description}'
author: YourName

# NMS plugins should use paper-plugin.yml (not plugin.yml)
# to enable the Paper plugin lifecycle (better load order)
```

> ⚠️ `paper-plugin.yml` suits NMS plugins better than `plugin.yml`, because the Paper plugin lifecycle is guaranteed to load before Bukkit plugins, which lets NMS registration be handled correctly.

---

## 4. Main Class Template

```java
package com.example;

import org.bukkit.plugin.java.JavaPlugin;
import net.minecraft.server.MinecraftServer;

@SuppressWarnings("UnstableApiUsage")
public final class MyNmsPlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        MinecraftServer server = MinecraftServer.getServer();
        getLogger().info("NMS server: " + server.getServerVersion());
    }

    @Override
    public void onDisable() {
        // Clean up Netty handlers, entity registration, etc.
    }
}
```

---

## 5. NMS Version Table

| Paper build version | MC version | CraftBukkit package | ServerPlayer location |
|--------------|--------|--------------------|----------------------|
| `1.21.11-R0.1-SNAPSHOT` (**verified**) | 1.21.11 | `org.bukkit.craftbukkit` | `net.minecraft.server.level.ServerPlayer` |
| `26.1.2.build.<n>-stable` | 26.1.2 | `org.bukkit.craftbukkit` | same as above |
| `26.2.build.132-stable` (**default, verified**) | 26.2 | `org.bukkit.craftbukkit` | same as above |
| `26.3.build.<n>-beta` | 26.3 (Paper still in beta) | `org.bukkit.craftbukkit` | same as above |

> From 26.x on, the Paper dev bundle version format changed to `<MC version>.build.<build number>-<channel>` (no longer `-R0.1-SNAPSHOT`). The latest build can be looked up at
> https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml

> Paper 1.20.5+ removed CraftBukkit's version-number relocation, so the package is always `org.bukkit.craftbukkit` (no `v1_21_R1` suffix); `v1_xx_Rx` only exists on Spigot and Paper 1.20.4 and earlier.
>
> Main differences from 1.21.11 → 26.x: `ServerBossEvent` constructor gains a UUID, vanilla entity constants moved to `EntityTypes`, `ServerboundInteractPacket` became a record with `ServerboundAttackPacket` split out, `ClientboundExplodePacket` constructor reworked (templates mark these with `// @1.21.11:` or `// @only`).
>
> Common NMS changes when upgrading from 1.21.3 and earlier to 1.21.11 / 26.x (all skill templates already account for them):
> - `ResourceLocation` → `Identifier`; vanilla `EntityType.XXX` constants moved to `EntityTypes`; `Entity.moveTo()` → `snapTo()`; `Level.isClientSide` field → `isClientSide()`
> - Entity and BlockEntity serialization now uses `ValueOutput` / `ValueInput`; `CompoundTag.getXxx(key)` returns `Optional` (plus `getXxxOr(key, default)`)
> - `Component.Serializer` removed; Adventure ↔ NMS now uses `PaperAdventure.asVanilla()` / `asAdventure()`
> - authlib: `GameProfile` became a record (`id()` / `name()` / `properties()`); player profile lookup now uses `MinecraftServer.services()`
> - Some mob classes moved into subpackages (e.g. `net.minecraft.world.entity.monster.zombie.Zombie`)

---

## 6. `@SuppressWarnings("UnstableApiUsage")`

Every class that accesses NMS must have this annotation. The Paper NMS API is marked unstable and the compiler warns; `@SuppressWarnings("UnstableApiUsage")` suppresses the warning without affecting runtime.

```java
@SuppressWarnings("UnstableApiUsage")
public class MyHandler { ... }
```

---

## 7. Deployment Differences (vs a regular Paper plugin)

| Item | Regular Paper plugin | NMS plugin |
|------|------------------|-----------|
| Build plugin | `java`, `shadow` (optional) | `paperweight.userdev` |
| Mappings source | Bukkit/Paper API | Paper + NMS (Mojang-mapped) |
| Deployment artifact | `build/libs/*.jar` | `build/libs/*.jar` (no reobf needed) |
| Version compatibility | Broad (api-version) | Narrow (recompile for each MC version) |

---

## 8. NMS Confinement & Version Guard

NMS is the part of a plugin most likely to break across versions (even across Paper builds of the same version). All NMS skills follow these rules:

| Rule | Approach |
|------|------|
| Single package | Only the `.../nms/` package may import `net.minecraft` / `org.bukkit.craftbukkit`; guard this with a source-scanning test (see `nms-fake-player` example 3) |
| No NMS types in public signatures | Expose only Bukkit types, so other classes can hold them safely and nothing fails at load time on a version mismatch |
| Version guard disables only that feature | The guard class only compares `Bukkit.getMinecraftVersion()` and never touches NMS; catch `LinkageError` on the first NMS call, disable only that feature, and log once |
| No server classes in the jar | Add a check such as `verifyNoServerClassesInJar` to make sure `net/minecraft/`, `org/bukkit/craftbukkit/`, `com/mojang/` are not bundled |
| Look for a Paper API first | Don't write NMS for anything achievable with the Paper API or PacketEvents (see `Skills/paper/`) |

---

## 9. Related Skills

| Skill ID | Purpose |
|--------|------|
| `nms-packet-sender` | Send custom packets |
| `nms-packet-interceptor` | Netty pipeline packet interception |
| `nms-custom-entity` | Custom NMS entities + AI |
| `nms-reflection-bridge` | Cross-version reflection bridge |
| `nms-version-adapter` | Multi-version adapter pattern |
| `nms-fake-player` | Fake players without a client (bots) |

For common needs that do not require NMS (Dialog, SQLite, cross-plugin API, packet filtering, etc.), see [`Skills/paper-api/PLATFORM.md`](https://github.com/MrPippi/MJP-Paper-Skills/blob/main/Skills/paper-api/PLATFORM.md).

---

## 10. Further Reference

- **Paperweight docs**: https://github.com/PaperMC/paperweight
- **Paper development guide**: https://docs.papermc.io/paper/dev/getting-started/paper-plugins
- **NMS Javadoc** (unofficial integration): https://nms.screamingsandals.org/
