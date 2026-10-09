# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**專為 Paper 1.21.11 / 26.x（Mojang 官方命名）NMS 底層開發設計的 [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) 函式庫。**

MJP-Claude-Skills 提供經編譯驗證的 NMS 技能範本，Claude Code 在產生插件代碼前會先讀取這些範本，涵蓋封包、Netty 攔截、自定義實體、NBT／資料組件、GUI、計分板、Boss Bar、粒子、區塊存取、反射式存取與多版本 Adapter。

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> 版本變更紀錄：[CHANGELOG.md](CHANGELOG.md)

---

## 平台資訊

| 項目 | 說明 |
|------|------|
| **MC 版本** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **NMS 命名** | Mojang 官方名稱（Minecraft 26.1 起不再混淆） |
| **建置工具** | Gradle 8.11.2+（已驗證 9.8.1）+ Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **技能執行時** | `.claude/skills/`（Claude Code 專用） |

> 從 1.21.x 版範本升級？請參考 [CHANGELOG.md](CHANGELOG.md) 與 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 第 5 節的遷移重點。

---

## 技能列表

| Skill ID | 類別 | 功能 |
|----------|------|------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | 透過 `ServerPlayer.connection.send()` 發送 Clientbound 封包 |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | 注入 `ChannelDuplexHandler` 至 Netty pipeline 攔截／修改封包 |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | 自定義 NMS 生物與 `Goal` AI |
| [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | nms-entity | 以 `AttributeModifier` 讀寫實體屬性 |
| [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | nms-data | 物品 `custom_data` 與實體 NBT（`CompoundTag` / `ValueOutput`） |
| [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | nms-data | 物品 `DataComponentType` 組件系統（自定義資料、堆疊數、附魔…） |
| [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | nms-ui | `AbstractContainerMenu` 自定義 GUI，並橋接 Bukkit `InventoryHolder` |
| [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | nms-display | 以封包實作每人獨立 sidebar 與隊伍 |
| [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | nms-display | 以 `ServerBossEvent` 實作每人獨立 Boss Bar |
| [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | nms-player | NPC 與玩家頭顱的 `GameProfile` skin |
| [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | nms-world | 以 `ClientboundLevelParticlesPacket` 發送客戶端粒子 |
| [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | nms-world | 自定義 `BlockEntity`（持久化、Tick、客戶端同步） |
| [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | nms-world | 直接存取 `LevelChunk`／區段與批次改方塊 |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | 以 `MethodHandle` 快取存取 NMS，不需 Paperweight 編譯依賴 |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | 抽象 Adapter 介面 + runtime dispatch 實現多版本相容 |

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

Claude Code 會先讀取對應的 `SKILL.md`、[`PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 與共享的執行緒／命名說明，再產生代碼。

---

## 依賴說明

### 以技能產生的插件

| 依賴 | 版本 | 說明 |
|------|------|------|
| Paper 伺服器 | 1.21.11 / 26.2 | 範本以 build 132 編譯驗證 |
| Paper dev bundle（`paperweight.paperDevBundle`） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | 26.x 格式：`<mc>.build.<n>-<channel>`（[版本列表](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)） |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | Pre-release；不需 `reobfJar` |
| Gradle | 8.11.2+ | 已驗證 9.8.1 |
| JDK | 25 | toolchain 與 `options.release` |
| `com.gradleup.shadow`（選用） | `9.6.1` | 僅多模組／打包依賴時需要（見 `nms-version-adapter`） |
| `paper-api`（純反射或 core 模組） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

標準 `build.gradle` 與 `paper-plugin.yml` 範本見 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)。

### 文件網站（`web/`）

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3，完整清單與指令見 [`web/README.md`](web/README.md)。

---

## 倉庫結構

```
MJP-Claude-Skills/
├── .claude/skills/           ← Claude Code 執行時（與 Skills/ 鏡像，paper-nms/ 除外）
├── Skills/                   ← 規範技能來源
│   ├── skills-registry.yml   ← v6.0.0，15 個技能
│   ├── _shared/              ← nms-threading.md、nms-obfuscation.md
│   ├── paper-nms/PLATFORM.md ← build.gradle／paper-plugin.yml 範本與版本對照表
│   └── nms/<skill-id>/       ← SKILL.md + examples.md（15 個技能）
├── docs/paper-nms/           ← NMS API 速查表（封包、實體、網路、橋接）
├── web/                      ← Next.js 文件網站（static export → GitHub Pages）
├── .github/workflows/        ← ci.yml（PR 檢查）、nextjs.yml（部署）、Claude workflows
├── CHANGELOG.md
└── CLAUDE.md                 ← 本倉庫的 Claude Code 指引
```

---

## 開發

```bash
cd web
npm ci
npx tsc --noEmit   # 型別檢查
npm test           # characterization tests（node:test + tsx）
npm run build      # 靜態匯出至 web/out/
```

每個 Pull Request 都會由 CI（`.github/workflows/ci.yml`）執行相同檢查。

---

## 新增技能

1. 在 `Skills/nms/<slug>/` 建立 `SKILL.md` + `examples.md`（至少 2 個範例）
2. 同步至 `.claude/skills/nms/<slug>/`
3. 在兩份 `skills-registry.yml` 加入新條目
4. 新增 `web/data/skills/<slug>.md`，並更新 `web/tests/skills-api.data.test.ts` 的預期清單
5. 合併前以目前的 dev bundle 編譯驗證範本 class

完整 8 步流程與不變式見 `CLAUDE.md`。

---

## 授權

MIT
