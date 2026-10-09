# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**專為 Paper 1.21.11 / 26.x（Mojang 官方命名）NMS（net.minecraft.server）底層開發設計的 [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) 精選函式庫。**

MJP-Claude-Skills 提供經編譯驗證的 NMS 技能範本，Claude Code 在產生插件程式碼前會先讀取這些範本，涵蓋封包、Netty 攔截、自定義實體、NBT／資料組件、GUI、計分板、Boss Bar、粒子、區塊存取、反射式存取與多版本 Adapter。

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> 版本變更紀錄：[CHANGELOG.md](CHANGELOG.md)

---

## 平台資訊

| 項目 | 說明 |
|------|------|
| **MC 版本** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **NMS 命名** | Mojang 官方名稱（Minecraft 自 26.1 起不再混淆） |
| **建置工具** | Gradle 8.11.2+（已驗證 9.8.1）+ Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **技能執行時** | `.claude/skills/`（Claude Code） |

> 從 1.21.x 版範本升級？請參考 [CHANGELOG.md](CHANGELOG.md) 與 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 第 5 節的遷移說明。

---

## 技能列表

共 30 個技能，分為兩條路線：**NMS** 技能需要 Paperweight userdev；**Paper API** 技能只需 `paper-api`。所有範本皆已針對 Paper 1.21.11 與 26.2 編譯驗證。

### NMS 技能（`Skills/nms/`）

| Skill ID | 類別 | 功能 |
|----------|------|------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | 透過 `ServerPlayer.connection.send()` 發送 Clientbound 封包 |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | 注入 `ChannelDuplexHandler` 至 Netty pipeline 攔截／修改封包 |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | 自定義 NMS 生物與 `Goal` AI |
| [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | nms-entity | 以 `AttributeModifier` 讀寫實體屬性 |
| [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | nms-data | 透過 `CompoundTag` / `ValueOutput` 處理物品 `custom_data` 與實體 NBT |
| [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | nms-data | 物品 `DataComponentType` 系統（自定義資料、堆疊數、附魔…） |
| [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | nms-ui | 具備 Bukkit `InventoryHolder` 橋接的 `AbstractContainerMenu` GUI |
| [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | nms-display | 以計分板封包實作每位玩家獨立的 sidebar 與隊伍 |
| [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | nms-display | 以 `ServerBossEvent` 實作每位玩家獨立的 Boss Bar |
| [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | nms-player | NPC 與玩家頭顱的 `GameProfile` skin |
| [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | nms-world | 以 `ClientboundLevelParticlesPacket` 發送客戶端粒子 |
| [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | nms-world | 支援持久化、Tick 與客戶端同步的自定義 `BlockEntity` |
| [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | nms-world | 直接存取 `LevelChunk`／區段與批次修改方塊 |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | 以 `MethodHandle` 快取存取 NMS，不需 Paperweight 編譯依賴 |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | 具備 runtime dispatch 的多版本 Adapter 介面 |
| [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | nms-player | 以真實 NMS `ServerPlayer` 為基礎、無需客戶端的假玩家（機器人） |

### Paper API 技能（不使用 NMS，`Skills/paper/`）

| Skill ID | 類別 | 功能 |
|----------|------|------|
| [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | paper-ui | 具備主執行緒安全回呼的 Paper Dialog API 畫面 |
| [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | paper-ui | 支援分頁與點擊防護的 `InventoryHolder` 箱子 GUI |
| [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | paper-data | SQLite repository、`user_version` 遷移、單一寫入者 flusher |
| [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | paper-data | 不可變設定快照、`config-version`、MiniMessage 語言檔 |
| [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | paper-integration | 透過 `ServicesManager` 提供跨插件 API，可容忍 jar 版本差異 |
| [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | paper-integration | 軟依賴 Hook/Bridge、Vault、PlaceholderAPI 擴充 |
| [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | paper-integration | 內嵌 JDK `HttpServer` JSON API（localhost、速率限制、快照） |
| [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | paper-network | PacketEvents / ProtocolLib 封包過濾器（Netty 執行緒安全、fail-open） |
| [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | paper-network | 每位玩家獨立的世界邊界、時間、天氣與可見性幻象 |
| [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | paper-gameplay | 具備傷害歸屬與登出處理的 PvP 戰鬥標記 |
| [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | paper-gameplay | 安全落點搜尋、RTP、非同步傳送、預備時間與冷卻 |
| [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | paper-gameplay | 多幣種帳本、託管（escrow）與 Vault provider |
| [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | paper-command | 透過 `LifecycleEvents.COMMANDS` 註冊 Brigadier 指令 |
| [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | paper-world | 用完即棄的世界與可重置的競技場 |

---

## 快速開始

### 1. 安裝技能執行時

將 `.claude/skills/` 複製到你的專案根目錄：

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. 使用技能

Claude Code 會自動載入 `.claude/skills/`。用觸發關鍵字描述需求：

```
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

Claude Code 會先讀取對應的 `SKILL.md`、[`PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 與共享的執行緒／命名說明，再產生程式碼。

---

## 依賴說明

### 以技能產生的插件

| 依賴 | 版本 | 說明 |
|------|------|------|
| Paper 伺服器 | 1.21.11 / 26.2 | 範本以 build 132 編譯驗證 |
| Paper dev bundle（`paperweight.paperDevBundle`） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | 26.x 格式：`<mc>.build.<n>-<channel>`（[版本列表](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)） |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | 預發布版本；不需 `reobfJar` |
| Gradle | 8.11.2+ | 已驗證 9.8.1 |
| JDK | 25 | toolchain 與 `options.release` |
| `com.gradleup.shadow`（選用） | `9.6.1` | 僅多模組／打包建置時需要（見 `nms-version-adapter`） |
| `paper-api`（純反射／core 模組） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

標準 `build.gradle` 與 `paper-plugin.yml` 位於 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)（NMS 技能）與 [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md)（Paper API 技能，含軟依賴座標：VaultAPI 1.7.1、PlaceholderAPI 2.11.6、packetevents 2.13.0、ProtocolLib 5.3.0、sqlite-jdbc 3.49.1.0）。

### 文件網站（`web/`）

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3，完整清單與指令見 [`web/README.md`](web/README.md)。

---

## 倉庫結構

```
MJP-Claude-Skills/
├── .claude/skills/           ← Claude Code runtime (mirrors Skills/, except the PLATFORM folders)
├── Skills/                   ← Canonical skill sources
│   ├── skills-registry.yml   ← 30 skills (paper-nms + paper-api)
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md, paper-threading.md
│   ├── paper-nms/PLATFORM.md ← NMS build.gradle / paper-plugin.yml templates, version table
│   ├── paper-api/PLATFORM.md ← Paper API build.gradle, soft-dependency coordinates
│   ├── nms/<skill-id>/       ← SKILL.md + examples.md (16 NMS skills)
│   └── paper/<skill-id>/     ← SKILL.md + examples.md (14 Paper API skills)
├── docs/paper-nms/           ← NMS API quick reference (packets, entities, network, bridge)
├── web/                      ← Next.js documentation site (static export → GitHub Pages)
├── .github/workflows/        ← ci.yml (PR checks), nextjs.yml (deploy), Claude workflows
├── CHANGELOG.md
└── CLAUDE.md                 ← Instructions for Claude Code in this repo
```

---

## 開發

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # characterization tests (node:test + tsx)
npm run build      # static export to web/out/
```

每個 Pull Request 都會由 CI（`.github/workflows/ci.yml`）執行相同檢查。

---

## 新增技能

1. 在 `Skills/nms/<slug>/` 或 `Skills/paper/<slug>/` 建立 `SKILL.md` + `examples.md`（至少 2 個範例）
2. 同步至 `.claude/skills/` 下的相同路徑
3. 在兩份 `skills-registry.yml` 加入新條目
4. 新增 `web/data/skills/<slug>.md`，並更新 `web/tests/skills-api.data.test.ts` 的預期清單
5. 合併前以 Paper 1.21.11 與 26.2 編譯驗證範本 class

完整 9 步流程與不變式見 `CLAUDE.md`。

---

## 授權

MIT
