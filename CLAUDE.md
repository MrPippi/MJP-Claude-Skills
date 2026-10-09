# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What is This Repository

MJP-Claude-Skills (Minecraft NMS Claude Code Skills) 是一套 Paper 插件開發的 Claude Code Agent Skills 集合，分兩個平台：

- **NMS 技能**（`Skills/nms/`）：Paper NMS（net.minecraft.server）底層開發，需 Paperweight userdev
- **Paper API 技能**（`Skills/paper/`）：純 Paper API（`paper-api` compileOnly），涵蓋 Dialog、SQLite、跨插件 API、軟依賴、封包過濾等插件集常見模式

目標 MC 版本：**1.21.11** 與 **26.2**（兩版皆編譯驗證；範本預設 26.2，差異以 `// @1.21.11:` 標註）
目標命名：**Mojang 官方名稱**（Minecraft 26.1 起不再混淆；透過 Paperweight userdev）
執行時目錄：**`.claude/skills/`**（Claude Code 專用）
規範來源：**`Skills/`**（authoritative source，與 `.claude/skills/` 內容相同）

Web app（`web/`）保留供文件瀏覽；`web/data/skills/` 含全部 30 個技能頁面。

### Repository Layout

```
MJP-Claude-Skills/
├── CLAUDE.md                            ← 本檔（Claude Code 入口）
├── README.md                            ← 英文 README（翻譯來源）
├── README.{zh-TW,zh-CN,ja,ko,es,pt-BR,ru}.md ← 多語 README（修改 README.md 時同步更新）
├── CHANGELOG.md
├── .github/workflows/
│   ├── nextjs.yml                       ← main push：tsc + test + build + 部署 GitHub Pages
│   └── ci.yml                           ← PR：tsc + test + build（不部署）
├── .claude/
│   └── skills/                          ← Claude Code 執行時（30 個技能，與 Skills/ 同步）
│       ├── skills-registry.yml          ← 與 Skills/ 相同
│       ├── _shared/
│       └── nms/
├── Skills/                              ← Canonical source
│   ├── skills-registry.yml              ← v7.0.0，30 個技能（paper-nms + paper-api）
│   ├── _shared/
│   │   ├── nms-threading.md
│   │   ├── nms-obfuscation.md
│   │   └── paper-threading.md           ← Paper API 執行緒規則
│   ├── paper-nms/
│   │   └── PLATFORM.md                  ← Paperweight + Mojang 建置設定（NMS 技能）
│   ├── paper-api/
│   │   └── PLATFORM.md                  ← paper-api compileOnly 建置設定（Paper API 技能）
│   ├── nms/                             ← NMS 技能（每個含 SKILL.md + examples.md）
│   └── paper/                           ← Paper API 技能（每個含 SKILL.md + examples.md）
├── .cursor/                             ← 歷史殘留，不再維護
├── docs/
│   └── paper-nms/                       ← NMS API 速查表（深度參考資料）
│       ├── packets.md                   ← Clientbound/Serverbound 封包目錄
│       ├── entities.md                  ← 實體類層次、Goal 系統、Attribute 常數
│       ├── network.md                   ← Netty pipeline 結構與執行緒模型
│       └── bukkit-nms-bridge.md         ← Bukkit ↔ NMS 橋接轉換表
└── web/                                 ← Next.js 文件站
    └── data/skills/                     ← 30 個技能 .md（已完整）
```

---

## How to Use This Skills Library

當使用者要求產生插件代碼時，一律遵循：

1. **檢查 `.claude/skills/skills-registry.yml`** — 找出 `trigger_keywords` 匹配請求的技能，並看其 `platform`（`paper-nms` 或 `paper-api`）
2. **讀取對應的 `SKILL.md`** — `.claude/skills/nms/<id>/SKILL.md` 或 `.claude/skills/paper/<id>/SKILL.md`
3. **查看 `examples.md`** — 理解多種使用情境（同目錄）
4. **讀取平台設定** — NMS 技能讀 `Skills/paper-nms/PLATFORM.md`；Paper API 技能讀 `Skills/paper-api/PLATFORM.md`
5. **閱讀執行緒規則** — NMS：`Skills/_shared/nms-threading.md`、`nms-obfuscation.md`；Paper API：`Skills/_shared/paper-threading.md`
6. **專案規範優先** — 目標專案（例如 BlockoSMP、Bydsmp）有自己的 `CLAUDE.md`、`docs/`、`.claude/rules/` 時，範本與其衝突一律以專案規範為準
7. **深度 API 查詢**：若 SKILL.md 範本無法涵蓋需求，查閱 `docs/paper-nms/`：
   - `docs/paper-nms/packets.md` — 封包類名與建構子簽名
   - `docs/paper-nms/entities.md` — 實體 AI、Goal 系統、Attribute 常數
   - `docs/paper-nms/network.md` — Netty pipeline 與執行緒模型
   - `docs/paper-nms/bukkit-nms-bridge.md` — CraftXxx 橋接轉換

**絕對不要** 憑記憶產生 NMS 代碼 — 一律先讀取相關 `SKILL.md`、`PLATFORM.md` 與 `docs/paper-nms/`。

---

## Platform Reference

| 項目 | 內容 |
|------|------|
| MC 版本 | 1.21.11、26.2 |
| Paper Dev Bundle | `26.2.build.132-stable`（預設）、`1.21.11-R0.1-SNAPSHOT`（26.3 目前為 beta） |
| Paperweight | `io.papermc.paperweight.userdev` 2.0.0-beta.24+ |
| 命名 | Mojang 官方名稱（26.1 起原版不再混淆；Paper runtime 直接使用） |
| Java | 25（26.2）／21（1.21.11） |
| 建置工具 | Gradle 8.11.2+（Groovy DSL；Paperweight 2.x 需求） |
| Javadoc | https://jd.papermc.io/paper/26.2/ 、 https://jd.papermc.io/paper/1.21.11/ |
| 平台檔案 | `Skills/paper-nms/PLATFORM.md` |

---

## Skills Index

所有技能以 `Skills/skills-registry.yml`（v7.0.0）為準（共 30 個：NMS 16 個、Paper API 14 個）。✅ = 已同步至 `.claude/skills/`。

**NMS 技能**（`platform: paper-nms`，`Skills/nms/`）

| Skill ID | Category | Purpose | 狀態 |
|----------|----------|---------|------|
| `nms-packet-sender` | nms-packet | 發送自定義 Clientbound 封包 | ✅ |
| `nms-packet-interceptor` | nms-packet | Netty pipeline 封包攔截與修改 | ✅ |
| `nms-custom-entity` | nms-entity | 自定義 NMS 實體 + PathfinderGoal AI | ✅ |
| `nms-reflection-bridge` | nms-bridge | 無 Paperweight 依賴的反射式 NMS 存取 | ✅ |
| `nms-version-adapter` | nms-bridge | 多版本 NMS 相容的 Adapter 模式 | ✅ |
| `nms-nbt-manipulation` | nms-data | CompoundTag 讀寫物品/實體/方塊實體 NBT | ✅ |
| `nms-custom-menu` | nms-ui | AbstractContainerMenu 自定義容器 GUI | ✅ |
| `nms-scoreboard` | nms-display | NMS Scoreboard/Objective/Team 計分板 | ✅ |
| `nms-player-profile` | nms-player | GameProfile skin 注入（NPC 外觀） | ✅ |
| `nms-particle-effect` | nms-world | ClientboundLevelParticlesPacket 粒子效果 | ✅ |
| `nms-attribute-modifier` | nms-entity | AttributeMap/AttributeModifier 動態屬性 | ✅ |
| `nms-block-entity` | nms-world | 自定義 BlockEntity（NBT + Tick + 同步） | ✅ |
| `nms-data-component` | nms-data | DataComponentType 物品組件系統 | ✅ |
| `nms-chunk-access` | nms-world | LevelChunk 直接方塊/ChunkSection 存取 | ✅ |
| `nms-boss-event` | nms-display | ServerBossEvent Boss Bar 每人獨立控制 | ✅ |
| `nms-fake-player` | nms-player | 沒有客戶端的 NMS ServerPlayer 假玩家（機器人） | ✅ |

**Paper API 技能**（`platform: paper-api`，`Skills/paper/`）

| Skill ID | Category | Purpose | 狀態 |
|----------|----------|---------|------|
| `paper-dialog-ui` | paper-ui | Paper Dialog API 介面（回呼回主執行緒、確認鈕在右） | ✅ |
| `paper-chest-gui` | paper-ui | InventoryHolder 箱子 GUI（分頁、點擊防護、onDisable 關閉） | ✅ |
| `paper-sqlite-repository` | paper-data | SQLite Repository、user_version 遷移、單一寫入執行緒 | ✅ |
| `paper-config-lang` | paper-data | 不可變設定物件、config-version、MiniMessage 語言檔 | ✅ |
| `paper-service-api` | paper-integration | ServicesManager 跨插件 API（只加不改、容忍版本落差） | ✅ |
| `paper-softdepend-hook` | paper-integration | 軟依賴 Hook／Bridge、Vault、PlaceholderAPI expansion | ✅ |
| `paper-embedded-http` | paper-integration | 內嵌 JDK HttpServer JSON API（127.0.0.1、限流、快照） | ✅ |
| `paper-packetevents-filter` | paper-network | PacketEvents／ProtocolLib 封包過濾（Netty 執行緒、fail-open） | ✅ |
| `paper-client-side-effects` | paper-network | 只對單一玩家顯示的邊界／時間／天氣／隱藏玩家 | ✅ |
| `paper-combat-tag` | paper-gameplay | PvP 戰鬥標記（傷害歸屬、指令白名單、離線處理） | ✅ |
| `paper-safe-teleport` | paper-gameplay | 安全落點搜尋、RTP、非同步傳送與冷卻 | ✅ |
| `paper-economy-ledger` | paper-gameplay | 多幣別帳本、託管、Vault 提供者 | ✅ |
| `paper-brigadier-command` | paper-command | Brigadier 指令（LifecycleEvents.COMMANDS、k/m/b 金額） | ✅ |
| `paper-disposable-world` | paper-world | 拋棄式世界與競技場重置 | ✅ |

---

## Workflow Rules

### 環境與版本

- **MC 版本**：1.21.11、26.2
- **建置工具**：Gradle（Groovy DSL）— 不用 Maven
- **Java**：25（26.2）／21（1.21.11）
- **Paperweight**：預設所有 NMS skill 使用 Paperweight userdev
- **描述檔**：預設 `paper-plugin.yml`（非 `plugin.yml`）以確保 NMS 載入順序
- **註解**：所有存取 NMS 的類別加 `@SuppressWarnings("UnstableApiUsage")`

### 執行緒規則（NMS 特有）

| 情境 | 執行緒 |
|------|-------|
| 實體建立、世界寫入、`snapTo()`、`addFreshEntity()` | **Main thread** |
| `ServerPlayer.connection.send(packet)` | Any thread（Netty 自動排入 write queue） |
| 封包內容建構（依賴實體/世界狀態） | **Main thread** |
| Netty `channelRead` / `write` 內部 | **Netty IO thread**（禁呼叫 Bukkit API） |
| 阻塞 IO / DB / HTTP | Async（`Bukkit.getScheduler().runTaskAsynchronously`） |

Netty → Main 執行緒切換範例：

```java
@Override
public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
    if (msg instanceof ServerboundChatPacket chat) {
        // Netty 執行緒
        Bukkit.getScheduler().runTask(plugin, () -> {
            // 主執行緒：可安全操作 Bukkit/NMS 世界
            player.sendMessage(Component.text("Received"));
        });
    }
    super.channelRead(ctx, msg);
}
```

詳見 `Skills/_shared/nms-threading.md`。

### 映射與混淆

- **一律使用 Mojang 官方名稱**（Paperweight dev bundle 提供）
- Minecraft 26.1 起原版不再混淆；Paper runtime 直接使用官方名稱，無需 remap
- Spigot 命名（混淆／reobf）的外掛在 26.x **無法執行**
- CraftBukkit 套件在 Paper 1.20.5+ 固定為 `org.bukkit.craftbukkit`（**不帶** `v1_21_R1` 版本號）；需相容 Spigot / 舊版時用 `nms-reflection-bridge`
- 詳見 `Skills/_shared/nms-obfuscation.md`

### NMS 依賴宣告範本

```groovy
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

## Skills Structure

### Registry

`Skills/skills-registry.yml` 與 `.claude/skills/skills-registry.yml` **兩個檔案內容必須相同**，包含：

- `skills` 陣列：所有技能條目（`id`, `version`, `status`, `platform`, `category`, `skill_file`, `examples_file`, `inputs`, `outputs`, `tags`, `trigger_keywords`）
- `platforms` 陣列：`paper-nms`、`paper-api` 平台定義
- `shared` 陣列：指向 `_shared/` 下的共享參考文件

### SKILL.md 結構

```markdown
---
name: nms-{skill-id}
description: "中英雙語描述（含 NMS Paperweight 要求）"
---

# Skill Title / 技能標題

## 技能名稱 / Skill Name
## 目的 / Purpose
## NMS 版本需求 / NMS Version Requirements
## 觸發條件 / Triggers
## 輸入參數 / Inputs
## 輸出產物 / Outputs
## Paperweight 建置設定 / Build Setup
## 代碼範本 / Code Template
## 推薦目錄結構 / Recommended Directory Structure
## 執行緒安全注意事項 / Thread Safety
## 失敗回退 / Fallback
```

Paper API 技能（`Skills/paper/`）使用相同結構，差異：`name: paper-{skill-id}`、版本段落為「Paper 版本需求 / Paper Version Requirements」、建置段落為「建置設定 / Build Setup」並引用 `Skills/paper-api/PLATFORM.md`。範本只能 import Paper API 與 `PLATFORM.md` 列出的軟依賴，不可出現 `net.minecraft` / `org.bukkit.craftbukkit`。

### 新增技能流程（9 步）

1. 在 `Skills/nms/<slug>/`（NMS）或 `Skills/paper/<slug>/`（Paper API）建立目錄
2. 撰寫 `SKILL.md`（含 YAML frontmatter：`name`, `description`）
3. 撰寫 `examples.md`（**至少 2 個範例**，涵蓋不同使用情境）
4. 同步至 `.claude/skills/nms/<slug>/` 或 `.claude/skills/paper/<slug>/`
5. 將新條目加入 `Skills/skills-registry.yml` 與 `.claude/skills/skills-registry.yml`
6. 若涉及新平台，建立 `Skills/<platform>/PLATFORM.md`
7. 驗證觸發關鍵字無與既有技能衝突
8. 在 `web/data/skills/<slug>.md` 新增網站頁面，並更新 `web/tests/skills-api.data.test.ts` 的預期清單
9. 範本對 1.21.11 與 26.2 實際編譯驗證（NMS 技能用 dev bundle；Paper API 技能只用 `paper-api` 與 PLATFORM.md 列出的依賴）

---

## Web App (`web/`)

Next.js 16 靜態匯出至 `web/out/`。`web/data/skills/` 含全部 30 個技能（每個一個 `.md`）。

```bash
cd web
npm run dev           # dev server（http://localhost:3000）
npx tsc --noEmit      # TypeScript 型別檢查
npm test              # characterization tests（node:test + tsx，web/tests/）
npm run build         # 靜態匯出至 web/out/（robots.txt / sitemap.xml 由 app/robots.ts、app/sitemap.ts 產生）
```

### 技術堆疊

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24（CI） |
| Framework | Next.js 16.4.0（App Router） |
| UI | React 19.3.0, TypeScript 6.0（strict） |
| Styling | Tailwind CSS v4（`app/globals.css` 的 `@theme static` token；淺色 Claude 象牙白 + 陶土橘、深色暖炭；`data-theme` 手動切換） |
| Fonts | 標題 Source Serif 4、內文 Inter + 系統中文字、程式碼 JetBrains Mono、像素點綴 **俐方體 11 號**（Cubic 11，自訂子集 `shared/fonts/`） |
| Markdown | unified：remark-parse → remark-gfm → remark-rehype → rehype-sanitize → rehype-slug → Shiki（建置時雙主題高亮） |
| Search | Fuse.js v7.5.0（Skills）+ 文件頁標題比對 |
| Test | `node:test` + tsx |
| Deployment | GitHub Pages（`output: 'export'`） |

### 路由（文件中心）

| Route | 來源 |
|-------|------|
| `/` | 落地頁（hero 像素地景 + 終端機、雙平台、精選、速查表入口） |
| `/docs`、`/docs/getting-started` | 總覽、開始使用（文字在 `shared/i18n/locales/`） |
| `/docs/platforms/*`、`/docs/concepts/*`、`/docs/reference/*` | 直接讀 repo 內 `Skills/*/PLATFORM.md`、`Skills/_shared/*.md`、`docs/paper-nms/*.md`（註冊表 `web/features/docs/registry.ts`） |
| `/docs/skills`、`/docs/skills/[slug]` | `web/data/skills/`（`?platform=` / `?category=` 篩選） |
| `/skills/*`、`/categories/*`、`/guide` | 舊網址轉址頁（noindex，不進 sitemap） |

新增文件頁：在 `features/docs/registry.ts` 的 `DOC_SOURCES` 加一筆即可（sidebar、sitemap、搜尋自動更新）。站內 raw URL（meta refresh、`<img>`、Markdown 內連結）一律經 `withBasePath()`（`config/routes.ts`）。

### Minecraft 圖片素材

- `web/public/mc/`：完整原版資源包（使用者提供，gitignored，不提交、不部署）
- `web/public/art/`：網站實際使用的 13 個物品圖示與 5 張方塊貼圖（已提交，約 22 KB），由 `python web/scripts/mc-art.py` 從資源包擷取（需 Pillow；箱子正面、Creeper／Steve 臉從實體貼圖集裁切，橡樹葉以平原葉色上色）
- `web/config/mc-assets.ts`：`ITEM_ARTWORK`（圖示鍵 → PNG，缺的退回 `shared/ui/pixel-icons.ts` SVG）、`BLOCK_TEXTURES`（首頁地景）、`HERO_ARTWORK`（選用的場景截圖）；`tests/mc-assets.test.ts` 檢查檔案存在
- PNG 圖示只用整數倍尺寸（16／32／48／96px，`h-4`／`h-8`／`h-12`／`h-24`），否則像素粗細不均；外框用 `.mc-slot`（物品欄格子凹陷效果）

### 像素字型（俐方體 11 號）

- 用於 `font-pixel`、`.eyebrow`、徽章、數字、程式碼語言標籤；內文與程式碼不用
- 字型格線為每 em 12 格：只用 **12／24／36／48px**（`text-[12px]`、`text-[24px]`…），其他尺寸會模糊
- `shared/fonts/cubic-11-subset.woff2` 只含介面用字（約 630 字、28 KB），由 `python web/scripts/pixel-font.py <Cubic_11.ttf> <OFL.txt>` 產生（需 fonttools、brotli；原字型自 https://github.com/ACh-K/Cubic-11 下載）
- 修改 `shared/i18n/locales/`、技能 frontmatter 或文件標題後，若 `tests/pixel-font.test.ts` 失敗就重跑腳本；子集是衍生作品，`Cubic-11-OFL.txt` 必須一併保留

### 動態效果

- 全部樣式在 `web/app/motion.css`，只在 `html.motion-ok` 下生效；`motion-ok` 由 `<head>` 腳本（`layout/theme-script.ts`）在**未**偏好減少動態效果時加入 → 減少動態效果、停用 JS、爬蟲都看到靜態完整內容
- `shared/motion/MotionLayer.tsx`（掛在 AppShell）：捲動進場（`data-reveal` + `revealDelay(i)` 錯開）與主要按鈕的經驗值球粒子（`.btn-primary` 或 `[data-burst]`）；粒子數學在 `shared/motion/particles.ts`（有單元測試）
- 只用於靜態清單：篩選中的清單（技能瀏覽器）不要加 `data-reveal`，否則每次篩選都會重新隱藏
- 主題切換用 View Transitions API 從按鈕圓形擴散；不支援時直接切換
- 只動畫 `transform` / `opacity` / `clip-path`

### 關鍵路徑

| Path | Purpose |
|------|---------|
| `web/data/skills/` | 每個技能一個 `.md`；YAML frontmatter 驅動所有元資料 |
| `web/config/site.ts`、`web/config/routes.ts` | 站台常數；路由常數、轉址表、`withBasePath` |
| `web/shared/markdown/render.ts` | Markdown → HTML + headings（技能頁與文件頁共用） |
| `web/features/skills/api/skills.ts` | 技能資料存取（模組級快取；slug 僅接受 kebab-case） |
| `web/features/skills/lib/platform.ts` | 平台判定、分類 → 像素圖示對照 |
| `web/features/docs/` | 文件註冊表、載入、導覽（`lib/nav.ts`）、DocsShell / DocArticle |
| `web/tests/` | characterization tests 與 fixtures |

---

## Git Workflow

- 預設分支：`main`（開發與 CI/CD deploy）
- 功能分支：`claude/*` 或描述性名稱
- Commit message：使用 imperative mood，引用技能 ID 或元件名
- 絕不跳過 CI 直接推 `main`

---

## Key Invariants

1. **雙路徑同步**：`Skills/nms/`、`Skills/paper/`、`Skills/_shared/` 與 `.claude/skills/` 下對應目錄內容必須相同（`diff -rq Skills .claude/skills` 只應顯示 `Only in Skills: paper-api` 與 `Only in Skills: paper-nms`）。`skills-registry.yml` 兩份同理。

2. **`.cursor/` 不再維護**：歷史殘留，日後可能移除；Claude Code 工作一律以 `.claude/skills/` 為準。

3. **MC 版本**：所有技能範本必須同時對 Paper **1.21.11** 與 **26.2** 編譯驗證。預設寫 26.2 API；1.21.11 寫法不同的行在行尾加 `// @1.21.11: <替代程式碼>`，只適用單一版本的區塊第一行加 `// @only <版本>`（見 `Skills/paper-nms/PLATFORM.md`）。

4. **Mojang 官方名稱強制**：不產生 Spigot/混淆映射的代碼。

5. **執行緒安全**：所有產生的 Java 代碼必須遵守平台執行緒規則（見 Workflow Rules）。

6. **雙語要求**：技能標題、描述、觸發關鍵字皆須中英並陳。

7. **無資料庫**：Web app 直讀檔案系統，不引入 DB。

8. **Paperweight 依賴預設**：全部 NMS 技能皆預設使用 Paperweight；若需避免，使用 `nms-reflection-bridge`。Paper API 技能不使用 Paperweight，也不得 import NMS。

9. **NMS 隔離**：NMS 程式碼只放在單一 `nms/` 套件、公開簽名只用 Bukkit 型別、版本不符時只停用該功能（見 `Skills/paper-nms/PLATFORM.md` 第 8 節）。
