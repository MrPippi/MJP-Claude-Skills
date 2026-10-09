# NMS 混淆與 Mojang 映射 / NMS Obfuscation & Mojang Mappings

Paper NMS 開發的映射系統說明。本專案**一律使用 Mojang mappings**（透過 Paperweight userdev），不支援 Spigot/CraftBukkit 混淆映射。

---

## 映射系統對比

| 映射 | 範例類名 | 範例方法名 | 用途 |
|------|----------|-----------|------|
| **Mojang（官方）** | `net.minecraft.server.level.ServerPlayer` | `connection.send(packet)` | 開發時可讀 |
| **Spigot（歷史）** | `net.minecraft.server.v1_21_R1.EntityPlayer` | `b.a(packet)` | 已淘汰，不可用 |
| **Intermediary（Fabric）** | `class_3222` | `method_14369` | 僅 Fabric 使用 |

Paper 1.20.5+ 伺服器 runtime **已原生使用 Mojang mappings**，因此 Paperweight 產出的 plugin **無需 remap**，部署後直接可用。

---

## Paperweight userdev 核心

`io.papermc.paperweight.userdev` Gradle plugin 提供：

1. **`paperweight.paperDevBundle(version)`** — 以 Mojang-mapped 形式暴露 Paper + NMS API
2. **`reobfJar` task**（**非必要**）— 只有發布至舊版 Spigot runtime 才需要；Paper 1.20.5+ 可直接使用 `assemble`/`shadowJar` 產物
3. **自動下載** Paper Dev Bundle（含完整 NMS sources）

```gradle
plugins {
    id 'java'
    id 'io.papermc.paperweight.userdev' version '2.0.0-beta.24'
}

dependencies {
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(21)
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
3. **Mojang obfuscation maps** — https://launcher.mojang.com/v1/objects/.../server_mappings.txt
4. **Paper MiscChangeLog** — https://papermc.io/downloads/paper

---

## 相關技能

- `nms-reflection-bridge` — 需相容 Spigot / 舊版（`v1_xx_Rx` 套件）時的反射策略
- `nms-version-adapter` — 多版本 adapter 實作
