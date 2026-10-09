# Paper NMS Platform / Paper NMS 平台

本平台定義 Paper NMS 開發的基礎建置設定，使用 Paperweight userdev 與 Mojang mappings。所有 MJP-Claude-Skills NMS 技能產出的代碼皆預設此平台。

- **MC 版本範圍**：1.21 – 1.21.3
- **Java**：21（toolchain）
- **建置工具**：Gradle 8.11.2+（Groovy DSL；已驗證 9.8.1）— Paperweight 2.x 不支援更舊的 Gradle
- **映射**：Mojang mappings（透過 Paperweight userdev 2.0.0-beta.24，pre-release）
- **Javadoc**：https://jd.papermc.io/paper/1.21/

---

## 1. `build.gradle` 範本

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
    // Paperweight 提供 Mojang-mapped Paper + NMS API
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(21)
}

tasks {
    compileJava {
        options.encoding = 'UTF-8'
        options.release.set(21)
    }

    // Paper 1.20.5+ 無需 reobfJar；直接使用 assemble 產物（build/libs/*.jar）
    // 若有套用 shadow plugin（id 'com.gradleup.shadow'），再加上：
    //   assemble { dependsOn 'shadowJar' }
    // 未套用 shadow 時宣告 dependsOn 'shadowJar' 會讓 assemble 失敗（Task 'shadowJar' not found）

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

---

## 2. `settings.gradle` 範本

```groovy
rootProject.name = 'my-nms-plugin'
```

---

## 3. `paper-plugin.yml` 範本

```yaml
name: ${name}
version: '${version}'
main: com.example.MyNmsPlugin
api-version: '1.21'
description: '${description}'
author: YourName

# NMS 插件建議使用 paper-plugin.yml（非 plugin.yml）
# 以啟用 Paper plugin lifecycle（更好的 load order）
```

> ⚠️ `paper-plugin.yml` 比 `plugin.yml` 更適合 NMS 插件，因為 Paper plugin lifecycle 保證早於 Bukkit plugin 載入，能正確處理 NMS 註冊。

---

## 4. 主類別範本

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
        // 清理 Netty handler、entity registration 等
    }
}
```

---

## 5. NMS 版本對照表

| Paper 建置版本 | MC 版本 | CraftBukkit package | ServerPlayer location |
|--------------|--------|--------------------|----------------------|
| `1.21-R0.1-SNAPSHOT` | 1.21 | `org.bukkit.craftbukkit` | `net.minecraft.server.level.ServerPlayer` |
| `1.21.1-R0.1-SNAPSHOT` | 1.21.1 | `org.bukkit.craftbukkit` | 同上 |
| `1.21.3-R0.1-SNAPSHOT` | 1.21.3 | `org.bukkit.craftbukkit` | 同上 |

> Paper 1.20.5+ 已移除 CraftBukkit 的版本號 relocation，套件固定為 `org.bukkit.craftbukkit`（無 `v1_21_R1` 後綴）；`v1_xx_Rx` 只存在於 Spigot 與 Paper 1.20.4 以前。
>
> 1.21.2 起部分 NMS API 改名（例：`MobSpawnType` → `EntitySpawnReason`、`getMinSection()` → `getMinSectionY()`、`ClientboundExplodePacket` 建構子）。技能範本優先使用 1.21–1.21.3 皆存在的 API；無共同 API 時會分別標註。

---

## 6. `@SuppressWarnings("UnstableApiUsage")`

所有存取 NMS 的類別必須加上此註解。Paper NMS API 標記為 unstable，編譯器會警告，`@SuppressWarnings("UnstableApiUsage")` 抑制警告但不影響 runtime。

```java
@SuppressWarnings("UnstableApiUsage")
public class MyHandler { ... }
```

---

## 7. 部署差異（vs 一般 Paper plugin）

| 項目 | 一般 Paper plugin | NMS plugin |
|------|------------------|-----------|
| build plugin | `java`、`shadow`（選） | `paperweight.userdev` |
| 映射來源 | Bukkit/Paper API | Paper + NMS（Mojang-mapped） |
| 部署產物 | `build/libs/*.jar` | `build/libs/*.jar`（無需 reobf） |
| 版本相容 | 廣（api-version）| 窄（每個 MC 版本需重編） |

---

## 8. 相關技能

| 技能 ID | 用途 |
|--------|------|
| `nms-packet-sender` | 發送自定義封包 |
| `nms-packet-interceptor` | Netty pipeline 封包攔截 |
| `nms-custom-entity` | 自定義 NMS 實體 + AI |
| `nms-reflection-bridge` | 跨版本反射橋接 |
| `nms-version-adapter` | 多版本 adapter 模式 |

---

## 9. 進階參考

- **Paperweight 文件**：https://github.com/PaperMC/paperweight
- **Paper 開發指南**：https://docs.papermc.io/paper/dev/getting-started/paper-plugins
- **NMS Javadoc**（非官方整合）：https://nms.screamingsandals.org/
