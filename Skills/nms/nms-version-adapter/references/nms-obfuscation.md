<!-- Generated from Skills/_shared/nms-obfuscation.md by scripts/sync-skill-references.mjs. Do not edit; change the source and re-run the script. -->

# NMS 混淆與 Mojang 映射 / NMS Obfuscation & Mojang Mappings

Paper NMS 開發的命名系統說明。**Minecraft 26.1 起 Mojang 不再混淆 Java 版**，伺服器 jar 直接使用官方名稱；
本專案一律使用 Mojang 官方名稱（透過 Paperweight userdev），不支援 Spigot/混淆映射。

---

## 映射系統對比

| 映射 | 範例類名 | 範例方法名 | 用途 |
|------|----------|-----------|------|
| **Mojang（官方）** | `net.minecraft.server.level.ServerPlayer` | `connection.send(packet)` | 開發時可讀 |
| **Spigot（歷史）** | `net.minecraft.server.v1_21_R1.EntityPlayer` | `b.a(packet)` | 已淘汰；26.x 執行不了 Spigot 命名的外掛 |
| **Intermediary（Fabric）** | `class_3222` | `method_14369` | 僅 Fabric 使用 |

Paper 1.20.5+ 伺服器 runtime 即使用 Mojang 名稱；26.1 起原版本身已不混淆。Paperweight 產出的 plugin **無需 remap**，部署後直接可用。

---

## Paperweight userdev 核心

`io.papermc.paperweight.userdev` Gradle plugin 提供：

1. **`paperweight.paperDevBundle(version)`** — 以 Mojang-mapped 形式暴露 Paper + NMS API
2. **不需要 `reobfJar`** — 26.x 沒有混淆可還原；直接使用 `assemble` / `shadowJar` 產物
3. **自動下載** Paper Dev Bundle（含完整 NMS sources）

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

## 套件命名對照

| 層級 | Mojang 名稱 | 常見內容 |
|------|------------|---------|
| 玩家 | `net.minecraft.server.level.ServerPlayer` | NMS 玩家本體 |
| 世界 | `net.minecraft.server.level.ServerLevel` | NMS 世界 |
| 連線 | `net.minecraft.server.network.ServerGamePacketListenerImpl` | 玩家網路連線 |
| 封包基類 | `net.minecraft.network.protocol.Packet<?>` | 所有封包超型 |
| Clientbound 封包 | `net.minecraft.network.protocol.game.Clientbound*` | 伺服器→客戶端 |
| Serverbound 封包 | `net.minecraft.network.protocol.game.Serverbound*` | 客戶端→伺服器 |
| 實體 | `net.minecraft.world.entity.Entity` | 所有實體基類 |
| 物品 | `net.minecraft.world.item.ItemStack`（NMS 版） | 與 Bukkit `ItemStack` 不同 |

---

## Bukkit ↔ NMS 橋接

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

> Paper 1.20.5+ 已移除 CraftBukkit 的版本號 relocation，套件固定為 `org.bukkit.craftbukkit`（無 `v1_21_R1` 後綴）；`v1_xx_Rx` 只存在於 Spigot 與 Paper 1.20.4 以前。
> 若外掛需同時支援 Spigot 或 1.20.4 以前的 Paper，使用 `nms-reflection-bridge` 技能動態取得套件名。

---

## 相對路徑穩定性

| 穩定度 | API 位置 | 升級策略 |
|--------|----------|---------|
| 🟢 高 | `net.minecraft.world.*`、`.server.level.*` | 直接升級通常 OK |
| 🟡 中 | `.network.protocol.game.*`（封包） | 新版常改欄位名/record 結構 |
| 🔴 低 | `.server.MinecraftServer` 私有欄位 | 每版可能改欄位可見度 |
| 🟢 高（Paper 1.20.5+） | `org.bukkit.craftbukkit.*` | 不再帶版本號；Spigot / 舊版 Paper 為 `org.bukkit.craftbukkit.v1_xx_Rx.*` |

---

## 為何不用 ReflectionRemapper？

歷史上（1.20.4 及以前），Paper plugin 需要透過 `ReflectionRemapper` API 將 Mojang 名稱轉為 runtime Spigot 名稱。**1.20.5 開始 Paper runtime 原生使用 Mojang mappings**，因此：

- ✅ 寫 Mojang 名稱即是 runtime 名稱
- ✅ `Class.forName("net.minecraft.server.level.ServerPlayer")` 直接可用
- ❌ 不需 `PaperLib.getMinecraftVersion()` 做 remap 分支

---

## 跨版本變更追蹤

升級 NMS 版本時檢查順序：

1. **Paperweight changelog** — https://github.com/PaperMC/Paper/blob/master/build-data/paper.yml
2. **NMS diff** — 用 IDE 比對 `~/.gradle/caches/paperweight/` 下不同版本的 sources
3. **Mojang obfuscation maps** — 僅 1.21.11 以前需要；26.1 起原版不混淆、不再提供 mappings
4. **Paper MiscChangeLog** — https://papermc.io/downloads/paper

---

## 相關技能

- `nms-reflection-bridge` — 需相容 Spigot / 舊版（`v1_xx_Rx` 套件）時的反射策略
- `nms-version-adapter` — 多版本 adapter 實作
