<!-- Generated from Skills/paper-nms/PLATFORM.md by scripts/sync-skill-references.mjs. Do not edit; change the source and re-run the script. -->

# Paper NMS Platform / Paper NMS 平台

本平台定義 Paper NMS 開發的基礎建置設定，使用 Paperweight userdev 與 Mojang 官方命名（Minecraft 26.1 起原版不再混淆）。所有 MJP-Paper-Skills NMS 技能產出的代碼皆預設此平台。

- **MC 版本**：**1.21.11** 與 **26.2**（兩版皆經編譯驗證；範本預設 26.2）
- **Java**：1.21.11 → 21；26.2 → 25（Paper 26.x 最低需求）
- **建置工具**：Gradle 8.11.2+（Groovy DSL；已驗證 9.8.1）— Paperweight 2.x 不支援更舊的 Gradle
- **命名**：Mojang 官方名稱（透過 Paperweight userdev 2.0.0-beta.24，pre-release）
- **Javadoc**：https://jd.papermc.io/paper/26.2/ ・ https://jd.papermc.io/paper/1.21.11/

### 版本差異標註慣例

範本預設寫 26.2 的 API。1.21.11 寫法不同的那一行，會在行尾加上替代程式碼：

```text
CustomZombie zombie = new CustomZombie(EntityTypes.ZOMBIE, level); // @1.21.11: CustomZombie zombie = new CustomZombie(EntityType.ZOMBIE, level);
```

- 目標為 1.21.11 時，把該行換成 `// @1.21.11:` 後面的程式碼
- 整段只適用單一版本的程式碼區塊，第一行為 `// @only 26.2` 或 `// @only 1.21.11`
- 驗證流程會依此替換後，分別對兩個 dev bundle 編譯

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

**1.21.11 版**：上方範本改三處即可（已實際 build 驗證）

| 項目 | 26.2（預設） | 1.21.11 |
|------|-------------|---------|
| `paperweight.paperDevBundle(...)` | `'26.2.build.132-stable'` | `'1.21.11-R0.1-SNAPSHOT'` |
| `JavaLanguageVersion.of(...)` / `options.release.set(...)` | `25` | `21` |
| `paper-plugin.yml` 的 `api-version` | `'26.2'` | `'1.21.11'` |

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
api-version: '26.2'
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
| `1.21.11-R0.1-SNAPSHOT`（**已驗證**） | 1.21.11 | `org.bukkit.craftbukkit` | `net.minecraft.server.level.ServerPlayer` |
| `26.1.2.build.<n>-stable` | 26.1.2 | `org.bukkit.craftbukkit` | 同上 |
| `26.2.build.132-stable`（**預設、已驗證**） | 26.2 | `org.bukkit.craftbukkit` | 同上 |
| `26.3.build.<n>-beta` | 26.3（Paper 仍為 beta） | `org.bukkit.craftbukkit` | 同上 |

> 26.x 起 Paper dev bundle 版本格式改為 `<MC版本>.build.<build號>-<channel>`（不再是 `-R0.1-SNAPSHOT`），可在
> https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml 查詢最新 build。

> Paper 1.20.5+ 已移除 CraftBukkit 的版本號 relocation，套件固定為 `org.bukkit.craftbukkit`（無 `v1_21_R1` 後綴）；`v1_xx_Rx` 只存在於 Spigot 與 Paper 1.20.4 以前。
>
> 1.21.11 → 26.x 主要差異：`ServerBossEvent` 建構子新增 UUID、原版實體常數移至 `EntityTypes`、`ServerboundInteractPacket` 改為 record 並拆出 `ServerboundAttackPacket`、`ClientboundExplodePacket` 建構子改版（範本以 `// @1.21.11:` 或 `// @only` 標註）。
>
> 從 1.21.3 以前升級到 1.21.11 / 26.x 常見的 NMS 變更（技能範本皆已對應）：
> - `ResourceLocation` → `Identifier`；原版 `EntityType.XXX` 常數移至 `EntityTypes`；`Entity.moveTo()` → `snapTo()`；`Level.isClientSide` 欄位 → `isClientSide()`
> - 實體與 BlockEntity 序列化改用 `ValueOutput` / `ValueInput`；`CompoundTag.getXxx(key)` 回傳 `Optional`（另有 `getXxxOr(key, default)`）
> - `Component.Serializer` 移除，Adventure ↔ NMS 改用 `PaperAdventure.asVanilla()` / `asAdventure()`
> - authlib：`GameProfile` 成為 record（`id()` / `name()` / `properties()`）；玩家 profile 查詢改用 `MinecraftServer.services()`
> - 部分 mob 類別移入子套件（例：`net.minecraft.world.entity.monster.zombie.Zombie`）

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

## 8. NMS 隔離與版本守門 / NMS Confinement & Version Guard

NMS 是插件中最容易隨版本（甚至同版本不同 Paper build）壞掉的部分，所有 NMS 技能都遵守：

| 規則 | 做法 |
|------|------|
| 單一套件 | 只有 `…/nms/` 套件可以 import `net.minecraft` / `org.bukkit.craftbukkit`；可用原始碼掃描測試守住（見 `nms-fake-player` 範例 3） |
| 公開簽名不出現 NMS 型別 | 對外只交 Bukkit 型別，其他類別才能安全持有，版本不符時也不會在載入時失敗 |
| 版本守門只關閉該功能 | 守門類別只比對 `Bukkit.getMinecraftVersion()`，不碰 NMS；第一次呼叫 NMS 時接 `LinkageError`，只停用該功能並記錄一次 |
| jar 不含伺服器類別 | 加 `verifyNoServerClassesInJar` 之類的檢查，確保 `net/minecraft/`、`org/bukkit/craftbukkit/`、`com/mojang/` 沒被打包 |
| 先找 Paper API | 能用 Paper API 或 PacketEvents 做到的事，不寫 NMS（見 `Skills/paper/`） |

---

## 9. 相關技能

| 技能 ID | 用途 |
|--------|------|
| `nms-packet-sender` | 發送自定義封包 |
| `nms-packet-interceptor` | Netty pipeline 封包攔截 |
| `nms-custom-entity` | 自定義 NMS 實體 + AI |
| `nms-reflection-bridge` | 跨版本反射橋接 |
| `nms-version-adapter` | 多版本 adapter 模式 |
| `nms-fake-player` | 沒有客戶端的假玩家（機器人） |

不需要 NMS 的常見需求（Dialog、SQLite、跨插件 API、封包過濾等）見 [`Skills/paper-api/PLATFORM.md`](https://github.com/MrPippi/MJP-Paper-Skills/blob/main/Skills/paper-api/PLATFORM.md)。

---

## 10. 進階參考

- **Paperweight 文件**：https://github.com/PaperMC/paperweight
- **Paper 開發指南**：https://docs.papermc.io/paper/dev/getting-started/paper-plugins
- **NMS Javadoc**（非官方整合）：https://nms.screamingsandals.org/
