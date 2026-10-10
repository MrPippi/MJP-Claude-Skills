# Paper API Platform / Paper API 平台

`Skills/paper/` 底下的技能只使用 **Paper API**（`paper-api` compileOnly），不需要 Paperweight，也不碰 `net.minecraft` / `org.bukkit.craftbukkit`。
需要 NMS 時改用 `Skills/nms/` 的技能與 [`Skills/paper-nms/PLATFORM.md`](../paper-nms/PLATFORM.md)。

- **MC 版本**：**1.21.11** 與 **26.2**（兩版皆經編譯驗證；範本預設 26.2，差異以 `// @1.21.11:` 行尾標註，規則同 paper-nms 平台）
- **Java**：1.21.11 → 21；26.2 → 25
- **建置工具**：Gradle 8.11.2+（Groovy DSL 範例；Kotlin DSL 寫法相同）
- **Javadoc**：https://jd.papermc.io/paper/26.2/ ・ https://jd.papermc.io/paper/1.21.11/

---

## 1. `build.gradle` 範本

```groovy
plugins {
    id 'java'
    id 'com.gradleup.shadow' version '9.6.1' // 只有需要打包第三方函式庫時才需要
}

group = 'com.example'
version = '1.0.0'

repositories {
    mavenCentral()
    maven { url = 'https://repo.papermc.io/repository/maven-public/' }
    // 以下依實際使用的軟依賴加入
    maven { url = 'https://jitpack.io' }                                  // VaultAPI
    maven { url = 'https://repo.extendedclip.com/releases/' }             // PlaceholderAPI
    maven { url = 'https://repo.codemc.io/repository/maven-releases/' }   // PacketEvents
    maven { url = 'https://repo.dmulloy2.net/repository/public/' }        // ProtocolLib
}

dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable' // 1.21.11：'1.21.11-R0.1-SNAPSHOT'

    // 軟依賴（伺服器上由對應插件提供，不可打包進 jar）
    compileOnly 'com.github.MilkBowl:VaultAPI:1.7.1'
    compileOnly 'me.clip:placeholderapi:2.11.6'
    compileOnly 'com.github.retrooper:packetevents-spigot:2.13.0'
    compileOnly 'com.comphenix.protocol:ProtocolLib:5.3.0'

    // SQLite：含 JNI 原生函式庫，不要 shade；改在 plugin.yml 的 libraries: 由伺服器下載
    compileOnly 'org.xerial:sqlite-jdbc:3.49.1.0'
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(25) // 1.21.11：21
}

tasks.withType(JavaCompile).configureEach {
    options.encoding = 'UTF-8'
    options.release.set(25) // 1.21.11：21
}
```

| 項目 | 26.2（預設） | 1.21.11 |
|------|-------------|---------|
| `paper-api` 版本 | `26.2.build.132-stable` | `1.21.11-R0.1-SNAPSHOT` |
| Java toolchain / `options.release` | `25` | `21` |
| `plugin.yml` / `paper-plugin.yml` 的 `api-version` | `'26.2'` | `'1.21.11'` |

> 上表依賴版本為 BlockoSMP / Bydsmp 實際使用、且本庫已編譯驗證的版本。

---

## 2. `plugin.yml` 範本（一般插件）

```yaml
name: Example
version: '${version}'
main: com.example.ExamplePlugin
api-version: '26.2'
softdepend: [Vault, PlaceholderAPI, packetevents]
libraries:
  - org.xerial:sqlite-jdbc:3.49.1.0
commands:
  example:
    description: Example command
    permission: example.use
permissions:
  example.use:
    default: true
```

- 需要 Paper bootstrap（例如在 registry 階段註冊 Dialog）時改用 `paper-plugin.yml` + `PluginBootstrap`，見 `paper-dialog-ui`。
- 軟依賴一律宣告在 `softdepend`，程式中以 `getPlugin(name) != null` 判斷，見 `paper-softdepend-hook`。

---

## 3. 共通規範

| 規範 | 說明 |
|------|------|
| 執行緒 | Bukkit API 只在主執行緒；IO／JDBC／HTTP 一律非同步；回到主執行緒後重新驗證狀態。詳見 [`_shared/paper-threading.md`](../_shared/paper-threading.md) |
| 訊息 | Adventure / MiniMessage；不要用 `ChatColor` 或 `§` |
| 設定 | 啟動時解析成不可變物件；reload 時建立新物件再原子替換，見 `paper-config-lang` |
| 跨插件 | 只透過 ServicesManager 發布的介面互通，見 `paper-service-api` |
| 軟依賴 | Hook／Bridge 分離，避免 class 載入失敗，見 `paper-softdepend-hook` |
| 專案規範優先 | 產生程式碼前先讀目標專案的 `CLAUDE.md` / `docs/` 規範（命名、分層、測試方式），範本與專案規範衝突時以專案為準 |

---

## 4. 技能清單

| 技能 | 類別 | 用途 |
|------|------|------|
| `paper-dialog-ui` | paper-ui | Paper Dialog API 介面 |
| `paper-chest-gui` | paper-ui | InventoryHolder 箱子 GUI |
| `paper-sqlite-repository` | paper-data | SQLite Repository + schema 遷移 + 單一寫入執行緒 |
| `paper-config-lang` | paper-data | 不可變設定物件 + MiniMessage 語言檔 |
| `paper-service-api` | paper-integration | ServicesManager 跨插件 API |
| `paper-softdepend-hook` | paper-integration | 軟依賴 Hook／Bridge + PlaceholderAPI expansion |
| `paper-embedded-http` | paper-integration | 內嵌 HTTP API（JDK HttpServer） |
| `paper-packetevents-filter` | paper-network | PacketEvents／ProtocolLib 封包過濾 |
| `paper-client-side-effects` | paper-network | 只對單一玩家顯示的效果（虛擬世界邊界、時間、天氣、隱藏玩家） |
| `paper-combat-tag` | paper-gameplay | PvP 戰鬥標記 |
| `paper-safe-teleport` | paper-gameplay | 安全落點搜尋與非同步傳送（RTP） |
| `paper-economy-ledger` | paper-gameplay | 多幣別帳本 + Vault 提供者 |
| `paper-brigadier-command` | paper-command | Brigadier 指令（LifecycleEvents.COMMANDS） |
| `paper-disposable-world` | paper-world | 拋棄式世界／競技場重置 |
