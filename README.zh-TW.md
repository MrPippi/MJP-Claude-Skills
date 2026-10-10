<div align="center">

# MJP-Paper-Skills

**經編譯驗證的 Minecraft Paper 插件開發 Agent Skills**

採用 Mojang 官方命名的底層 NMS 與純 Paper API，適用於任何會讀取 `SKILL.md` 的 AI 程式設計工具

[![Paper](https://img.shields.io/badge/Paper-1.21.11%20%7C%2026.2-2ea44f)](https://papermc.io)
[![Java](https://img.shields.io/badge/Java-21%20%7C%2025-orange)](https://adoptium.net)
[![Skills](https://img.shields.io/badge/skills-30-blue)](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)
[![Agent Skills](https://img.shields.io/badge/format-Agent%20Skills-8a63d2)](https://agentskills.io)
[![Skills compile](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml/badge.svg)](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml)
[![License: MIT](https://img.shields.io/github/license/MrPippi/MJP-Paper-Skills)](LICENSE)

[**文件網站**](https://mrpippi.github.io/MJP-Paper-Skills) · [**技能目錄**](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills) · [**版本變更紀錄**](CHANGELOG.md)

[English](README.md) · 繁體中文 · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)

</div>

---

AI 程式設計工具常在 Paper 插件上出現細微錯誤：過時或已混淆的 NMS 名稱、在 Netty 或非同步執行緒中呼叫 Bukkit、跨版本變動的 API。MJP-Paper-Skills 為你的代理提供一套經過審核的作法。每個技能都是一份 `SKILL.md`，內含程式碼範本、建置設定、執行緒規則與失敗回退，代理會在撰寫程式碼前先讀取。

## 亮點

- **經編譯驗證**：CI 會在每次變更時，針對 Paper **1.21.11** 與 **26.2** 編譯每個完整範本；版本專屬的行會在行內標註。
- **Mojang 官方名稱**：NMS 程式碼使用 Paperweight userdev，以及 Minecraft 自 26.1 起以未混淆形式發行的名稱。
- **執行緒安全的設計**：每個技能都會說明每次呼叫是在哪個執行緒執行（主執行緒、Netty IO 或非同步）。
- **不限工具**：開放的 [Agent Skills](https://agentskills.io) 格式可搭配 Claude Code、OpenAI Codex、Cursor、GitHub Copilot、Gemini CLI 等工具。
- **兩條路線**：16 個處理底層工作的 NMS 技能，以及 14 個只需 `paper-api` 的 Paper API 技能。
- **易讀的文件**：每個技能也發布於[文件網站](https://mrpippi.github.io/MJP-Paper-Skills)，提供英文與繁體中文版本。

## 目錄

- [快速開始](#快速開始)
- [技能目錄](#技能目錄)
- [運作方式](#運作方式)
- [相容性](#相容性)
- [倉庫結構](#倉庫結構)
- [貢獻指南](#貢獻指南)
- [授權條款](#授權條款)

---

## 快速開始

### 1. 安裝技能

使用 [skills CLI](https://github.com/vercel-labs/skills) 直接從本儲存庫安裝。只需要 [Node.js](https://nodejs.org)（用於 `npx`），不需要帳號或註冊。

1. 在你的插件專案根目錄執行：

   ```bash
   npx skills add MrPippi/MJP-Paper-Skills
   ```

2. 選擇要安裝的技能。CLI 會偵測你的 AI 工具（Claude Code、Codex、Cursor……），詢問要為哪些工具安裝，以及使用符號連結（建議）還是複製。
3. 使用 `npx skills list` 確認結果。

每個技能都把所需的建置設定與執行緒規則打包在自己的 `references/` 資料夾中，因此單獨安裝一個技能也能運作。

| 目標 | 指令 |
|------|---------|
| 列出可用的技能 | `npx skills add MrPippi/MJP-Paper-Skills --list` |
| 安裝單一技能 | `npx skills add MrPippi/MJP-Paper-Skills --skill paper-dialog-ui` |
| 為指定工具安裝全部技能，不再詢問 | `npx skills add MrPippi/MJP-Paper-Skills --skill '*' -a claude-code codex -y` |
| 安裝到所有專案（例如 `~/.claude/skills/`） | 在任何 `add` 指令後加上 `-g` |
| 更新已安裝的技能 | `npx skills update` |
| 移除技能 | `npx skills remove paper-dialog-ui` |

<details>
<summary>手動安裝</summary>

將 `MJP-Paper-Skills/.claude/skills/` 複製到你的 AI 工具載入技能的資料夾：

| 工具 | 常見專案路徑 |
|------|---------------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex、Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # adjust the target for your tool
```

</details>

> [!NOTE]
> 技能路徑會因工具與版本而異，請查閱你所用工具的文件。許多工具也會將 `.agents/skills/` 當作共用位置讀取。

**使用的工具不支援 Agent Skills？** 請在它的指令檔（`AGENTS.md`、`.cursorrules`、`.github/copilot-instructions.md`……）中指向這些技能：

```markdown
Before writing Paper plugin code, find the matching skill in <skills-folder>/skills-registry.yml
(by trigger_keywords) and follow its SKILL.md, plus the files in its references/ folder.
```

### 2. 說出你的需求

用白話描述你要的功能。工具會將你的請求與每個技能的描述及觸發關鍵字進行比對：

```text
「用封包發送 Action Bar 訊息給玩家」
「攔截 ServerboundChatPacket 並過濾特定詞彙」
「建立一個有自己追擊 AI 的自定義 Zombie 實體」
「顯示只有這位玩家看得到的世界邊界」
```

---

## 技能目錄

共 30 個技能，皆已針對 Paper 1.21.11 與 26.2 編譯驗證。可在[文件網站](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)依條件篩選並查看完整範本；機器可讀的索引為 [`Skills/skills-registry.yml`](Skills/skills-registry.yml)。

### NMS（16 個技能，需要 Paperweight userdev）

| 類別 | 技能 | 功能 |
|----------|-------|--------------|
| 封包 | [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | 向單一玩家、一組玩家或所有人發送自定義 Clientbound 封包 |
| 封包 | [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | 在 Netty pipeline 中攔截並修改封包 |
| 實體 | [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | 搭配 PathfinderGoal AI 的自定義 NMS 實體 |
| 實體 | [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | 以 AttributeMap 與 AttributeModifier 動態調整屬性 |
| 玩家 | [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | 注入 GameProfile 外觀，作為 NPC 造型 |
| 玩家 | [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | 沒有客戶端的 ServerPlayer 假玩家（機器人） |
| 資料 | [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | 讀寫物品、實體與方塊實體上的 CompoundTag NBT |
| 資料 | [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | DataComponentType 物品組件 |
| 世界 | [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | 具備 NBT、Tick 與客戶端同步的自定義方塊實體 |
| 世界 | [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | 直接存取 LevelChunk 與 ChunkSection 方塊 |
| 世界 | [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | 透過 ClientboundLevelParticlesPacket 產生粒子效果 |
| 顯示 | [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | 計分板、Objective 與 Team |
| 顯示 | [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | 以 ServerBossEvent 為每位玩家獨立控制的 Boss Bar |
| 介面 | [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | 以 AbstractContainerMenu 建構的容器 GUI |
| 橋接 | [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | 不依賴 Paperweight、以反射存取 NMS |
| 橋接 | [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | 支援多版本 NMS 的 Adapter 模式 |

### Paper API（14 個技能，只需 `paper-api`）

| 類別 | 技能 | 功能 |
|----------|-------|--------------|
| 介面 | [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | 回呼在主執行緒執行的 Dialog API 畫面 |
| 介面 | [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | 具備分頁與點擊防護的 InventoryHolder 箱子 GUI |
| 資料 | [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | 具備 `user_version` 遷移與單一寫入執行緒的 SQLite Repository |
| 資料 | [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | 不可變設定物件、設定檔版本管理與 MiniMessage 語言檔 |
| 整合 | [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | 透過 ServicesManager 提供跨插件 API |
| 整合 | [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | Vault 與 PlaceholderAPI 的軟依賴 Hook |
| 整合 | [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | 綁定 localhost、附限流的內嵌 JSON HTTP API |
| 網路 | [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | 以 PacketEvents 或 ProtocolLib 過濾封包 |
| 網路 | [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | 每位玩家獨立的世界邊界、時間、天氣與隱藏玩家 |
| 玩法 | [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | PvP 戰鬥標記，含傷害歸屬與戰鬥中登出處理 |
| 玩法 | [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | 安全落點搜尋、隨機傳送、非同步傳送與冷卻 |
| 玩法 | [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | 多幣別帳本、託管與 Vault 經濟提供者 |
| 指令 | [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | 透過 `LifecycleEvents.COMMANDS` 註冊的 Brigadier 指令 |
| 世界 | [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | 拋棄式世界與競技場重置 |

---

## 運作方式

```text
Your request ──▶ skill description ──▶ SKILL.md ──▶ references/ ──▶ Generated code
                 (trigger keywords)     (template,     (build.gradle,
                                        inputs,        paper-plugin.yml,
                                        fallbacks)     threading, naming)
```

1. 代理透過技能的描述與觸發關鍵字，將你的請求對應到某個技能。
2. 它會讀取該技能的 `SKILL.md`（範本、輸入、輸出、執行緒安全說明、失敗回退）與 `examples.md`。
3. 它會套用 `references/` 中隨附的平台建置設定，內容由 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 或 [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md) 產生。
4. 它會遵循 `references/` 中隨附的執行緒與 Mojang 命名規則，內容由 [`Skills/_shared/`](Skills/_shared) 產生。

若需要範本以外的 API，請參考 [NMS 速查表](docs/paper-nms)，內容涵蓋封包、實體、Netty pipeline 以及 Bukkit ↔ NMS 橋接。

---

## 相容性

| 項目 | 支援範圍 |
|------|-----------|
| Minecraft / Paper | 1.21.11 與 26.2（範本預設為 26.2；1.21.11 的差異以 `// @1.21.11:` 標註） |
| Paper dev bundle | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| Java | 21 (1.21.11) / 25 (26.2) |
| 建置 | Gradle 8.11.2+（已驗證 9.8.1），Groovy DSL |
| Paperweight userdev | `2.0.0-beta.24`（僅 NMS 技能；不需 `reobfJar`） |
| Shadow（選用） | `com.gradleup.shadow` `9.6.1`，用於多模組建置（`nms-version-adapter`） |
| 軟依賴 | VaultAPI 1.7.1、PlaceholderAPI 2.11.6、packetevents 2.13.0、ProtocolLib 5.3.0、sqlite-jdbc 3.49.1.0 |

標準的 `build.gradle` 與 `paper-plugin.yml` 範本位於兩份 `PLATFORM.md`。從 1.21.x 範本升級？請參閱 [CHANGELOG.md](CHANGELOG.md) 與 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 第 5 節。

---

## 倉庫結構

```text
MJP-Paper-Skills/
├── .claude/skills/           # 可直接複製的技能資料夾（鏡像 Skills/，PLATFORM 資料夾除外）
├── Skills/                   # 技能的規範來源
│   ├── skills-registry.yml   # 全部 30 個技能的索引（paper-nms + paper-api）
│   ├── _shared/              # 所有技能共用的執行緒與命名規則
│   ├── paper-nms/PLATFORM.md # NMS build.gradle / paper-plugin.yml 範本、版本對照表
│   ├── paper-api/PLATFORM.md # Paper API 建置設定、軟依賴座標
│   ├── nms/<skill-id>/       # SKILL.md + examples.md + references/（16 個 NMS 技能）
│   └── paper/<skill-id>/     # SKILL.md + examples.md + references/（14 個 Paper API 技能）
├── scripts/                  # sync-skill-references.mjs（references/）、extract-skill-java.mjs（編譯檢查）
├── verify/                   # 為各版本編譯所擷取範本的 Gradle 專案
├── docs/paper-nms/           # NMS API 速查表
├── web/                      # Next.js 文件網站（靜態匯出至 GitHub Pages）
├── CHANGELOG.md
└── CLAUDE.md                 # 供在此倉庫工作的 AI 代理使用的維護者指引
```

---

## 貢獻指南

歡迎貢獻。新增技能的步驟：

1. 建立 `Skills/nms/<slug>/` 或 `Skills/paper/<slug>/`，內含 `SKILL.md` 與 `examples.md`（至少兩個範例）。
2. 同步至 `.claude/skills/` 下的相同路徑，然後執行 `node scripts/sync-skill-references.mjs` 產生其 `references/` 資料夾（每當 `PLATFORM.md` 或 `_shared/` 檔案變更時重新執行）。
3. 在兩份 `skills-registry.yml` 中加入該條目。
4. 新增網站頁面 `web/data/skills/<slug>.md` 及其英文內文 `web/data/skills/en/<slug>.md`，然後更新 `web/tests/skills-api.data.test.ts` 中的預期清單。
5. 確認範本可針對 Paper 1.21.11 與 26.2 編譯。每個涉及 `Skills/` 的 Pull Request，CI 都會執行此檢查；若要在本機執行（26.2 用 JDK 25，1.21.11 用 JDK 21）：

   ```bash
   node scripts/extract-skill-java.mjs 26.2
   cd verify && ./gradlew compileSkills -Pmc=26.2
   ```

完整流程與倉庫不變式記載於 [`CLAUDE.md`](CLAUDE.md)。若要開發文件網站：

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI 會在每個 Pull Request 上執行相同的檢查。網站的技術堆疊與腳本請見 [`web/README.md`](web/README.md)。

---

## 授權條款

[MIT](LICENSE) © MrPippi

非 Minecraft 官方產品。未經 Mojang 或 Microsoft 認可，亦與其無關。
