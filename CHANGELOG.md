# Changelog

本檔記錄 MJP-Claude-Skills 的重要變更，格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。
技能庫版本以 `Skills/skills-registry.yml` 的 `version` 為準。

## [Unreleased]

### Changed — 技能內文改為英文

- 30 個技能的 `SKILL.md`、`examples.md` 內文、程式碼註解與字串改為英文；frontmatter `description` 與觸發關鍵字（Triggers 段落）維持中英並陳，中文提問仍可觸發。逐檔比對確認程式碼未變動（只改註解與字串），並通過 26.2／1.21.11 編譯
- `Skills/paper-*/PLATFORM.md` 與 `Skills/_shared/*.md` 改為英文（`references/` 隨之更新）；原中文版移至 `web/data/docs/zh/`，網站繁中頁面不變
- 網站文件載入改為依 `registry.ts` 的 `sourceLang` 選擇來源或翻譯（`docs/paper-nms/` 仍以中文為來源）

### Added — 範本編譯 CI

- `scripts/extract-skill-java.mjs`：從 SKILL.md／examples.md 抽出完整 Java 檔（含 `package`），依目標版本套用 `// @1.21.11:` 與 `// @only`；Paper API 技能若 import NMS 直接失敗
- `verify/`：Gradle 9.8.1 + Paperweight 專案，每個技能（與其 examples）各自一個 source set，對 26.2（JDK 25）與 1.21.11（JDK 21）dev bundle 加上軟依賴、JUnit API 編譯
- `.github/workflows/skills-compile.yml`：改到 `Skills/`、`verify/` 時於 PR 與 main 執行雙版本編譯；README 加上狀態徽章
- 提交 `web/AGENTS.md`（`next dev` 產生的 Next.js 16 代理提示）

### Added — `npx skills add` 安裝

- 支援 [skills CLI](https://github.com/vercel-labs/skills)：`npx skills add MrPippi/MJP-Paper-Skills`（可用 `--skill <id>` 只裝單一技能）
- 每個技能新增 `references/`，內附該技能需要的 `PLATFORM.md` 與執行緒／命名規則副本，單獨安裝也完整可用；由 `scripts/sync-skill-references.mjs` 產生，`web/tests/skill-references.test.ts` 檢查是否同步
- `SKILL.md`／`examples.md` 中指向技能資料夾外的連結（`../../_shared/…`、`Skills/paper-*/PLATFORM.md`）改為 `references/<檔名>`
- README（8 種語言）與網站「開始使用」、首頁終端機改以 `npx skills add` 為主要安裝方式，手動複製收合為備選

### Changed — 專案改名與定位

- 專案更名 **MJP-Claude-Skills → MJP-Paper-Skills**；目標使用者擴大到任何支援 Agent Skills（`SKILL.md`）的 AI 編碼工具（Claude Code、OpenAI Codex、Cursor、GitHub Copilot、Gemini CLI…），不再限定 Claude Code
- README（8 種語言）：快速開始改為各工具的 Skills 目錄對照，並提供不支援 Agent Skills 時的 `AGENTS.md` 寫法；30 列 Skills 表格改為摘要加網站目錄連結
- 網站文案、標題、站名同步更新
- 移除不再使用的 `web/vercel.json`（改由 GitHub Pages 部署）


### Web（網站重新設計）

#### Changed
- 改為文件中心架構：`/docs`（總覽、開始使用、平台、核心概念、Skills、NMS 速查表），三欄版面（側欄導覽／內文／本頁目錄）
- 視覺改為 Claude 風格：淺色象牙白 + 陶土橘、深色暖炭，跟隨系統並可手動切換；Source Serif 標題、Silkscreen 像素字點綴
- Minecraft 點綴：SVG 像素圖示（分類、平台）、首頁像素地景、像素按鈕陰影與分隔線；可在 `web/config/mc-assets.ts` 換成遊戲截圖與物品圖
- 程式碼區塊改為建置時 Shiki 雙主題高亮（零執行時高亮 JS），附語言標籤與複製鈕
- 搜尋同時涵蓋 Skills 與文件頁；技能列表支援 `?platform=`、`?category=` 篩選

#### Fixed
- 切換語言後首頁「三步驟」永遠透明：步驟用標題當 React key，換語言時元素被替換而沒被捲動進場監看；改用穩定 key，並以 MutationObserver 監看之後新增的進場元素
- 捲動進場提早 20% 觸發、已捲過的元素直接顯示，快速捲動與整頁截圖不再拍到空白；列印時強制顯示全部內容
- 首頁終端機最後一行被打字動畫的 `clip-path` 裁掉（`generatec`）：改為可換行，動畫結束不再裁切

#### Added
- 動態效果：首頁終端機逐行打字、雲朵飄移、太陽／月亮浮動、樹葉搖曳、花粉／螢火蟲；捲動進場；卡片 hover 物品彈跳與格子高亮；複製成功彈跳；主要按鈕經驗值球粒子；主題切換圓形日夜過場。全部遵守 `prefers-reduced-motion`
- 像素字型改為俐方體 11 號（Cubic 11，OFL）子集（約 630 字、28 KB），中英文點綴文字一致像素化；取代只有拉丁字母的 Silkscreen；產生腳本 `web/scripts/pixel-font.py`
- 原版材質（26.3 資源包）：13 個物品圖示、首頁方塊地景改用真實貼圖，圖示外框改為物品欄格子；擷取腳本 `web/scripts/mc-art.py`
- `Skills/*/PLATFORM.md`、`Skills/_shared/*.md`、`docs/paper-nms/*.md` 直接渲染為網站頁面（單一來源，不複製）

#### Deprecated
- 舊網址 `/skills/*`、`/categories/*`、`/guide` 改為轉址頁（noindex），導向新路由

## [7.0.0] - 2026-10-09

技能庫 registry 版本 `6.0.0` → `7.0.0`（major：目標平台改為 Paper 1.21.11／26.2、範本 API 不相容變更、新增 `paper-api` 平台）。共 30 個技能。

### Paper API 技能（PR #16）

依 BlockoSMP 與 Bydsmp 插件集的實際模式新增技能；全部範本、examples 中的完整類別與 JUnit 測試，都對 Paper **1.21.11** 與 **26.2** 實際編譯，測試實際執行。

#### Added

- **Paper API 技能平台**：`Skills/paper/`、`Skills/paper-api/PLATFORM.md`（paper-api compileOnly、軟依賴座標）、`Skills/_shared/paper-threading.md`、registry `paper-api` 平台
- 14 個 Paper API 技能：`paper-dialog-ui`、`paper-chest-gui`、`paper-sqlite-repository`、`paper-config-lang`、`paper-service-api`、`paper-softdepend-hook`、`paper-embedded-http`、`paper-packetevents-filter`、`paper-client-side-effects`、`paper-combat-tag`、`paper-safe-teleport`、`paper-economy-ledger`、`paper-brigadier-command`、`paper-disposable-world`
- NMS 技能 `nms-fake-player`：沒有客戶端的 `ServerPlayer` 假玩家（機器人），NMS 限定單一套件、版本不符時只停用該功能
- 網站新增 15 個技能頁、NMS／Paper 分類圖示

#### Changed

- `nms-packet-interceptor`、`nms-packet-sender`、`nms-custom-menu`、`nms-player-profile`、`nms-custom-entity` 新增「替代方案／相關技能」段落（優先使用 Paper API、PacketEvents、Dialog）
- `Skills/paper-nms/PLATFORM.md` 新增「NMS 隔離與版本守門」規範
- CLAUDE.md、README（8 種語言）、網站文案改為「NMS + Paper API」兩大類，共 30 個技能
- Web 測試改為依資料動態計算數量；搜尋測試只鎖定必含結果

### 依賴升級、範本修正與 1.21.11／26.2 雙版本（PR #14、#15、#17）

涵蓋 PR [#14](https://github.com/MrPippi/MJP-Claude-Skills/pull/14)（依賴升級、安全修補、範本修正）與
PR [#15](https://github.com/MrPippi/MJP-Claude-Skills/pull/15)（移植至 Paper 26.2）。

#### ⚠️ Breaking

- **目標平台由 Minecraft 1.21 – 1.21.3 改為 Paper 1.21.11 與 26.2 雙版本**（#15）
  - 所有範本同時對 `1.21.11-R0.1-SNAPSHOT`（Java 21）與 `26.2.build.132-stable`（Java 25）編譯驗證；預設寫 26.2 API，1.21.11 不同處以行尾 `// @1.21.11:` 或區塊 `// @only <版本>` 標註
  - 26.x dev bundle 版本格式為 `<mc>.build.<n>-<channel>`
  - Minecraft 26.1 起原版不再混淆；文件改稱「Mojang 官方名稱」，Spigot 命名的外掛在 26.x 無法執行
  - 1.21.x 版範本不再維護，保留於 git 歷史
- **範本 API 跟隨 26.x 變更**（#15），既有依 1.21 範本產生的程式碼需比對調整：
  - `ResourceLocation` → `Identifier`；`EntityType.XXX` → `EntityTypes.XXX`；`Entity.moveTo()` → `snapTo()`；`Level.isClientSide` → `isClientSide()`
  - BlockEntity／Entity 序列化改用 `ValueOutput` / `ValueInput`；`CompoundTag.getXxx()` 回傳 `Optional`
  - `Component.Serializer` 移除，改用 `PaperAdventure.asVanilla()` / `asAdventure()`
  - authlib `GameProfile` 改為 record（`id()` / `name()` / `properties()`）；profile 查詢改用 `MinecraftServer.services()`
  - `ServerBossEvent` 建構子需 UUID；粒子封包新增 `alwaysShow`；`DiscardedPayload(Identifier, byte[])`
  - `DataComponents.UNBREAKABLE` 為 `Unit`（提示顯示改由 `TOOLTIP_DISPLAY` 控制）；`CustomModelData` 改為清單，`ItemComponentUtil.getCustomModelData()` 回傳 `Optional<Float>`
  - `nms-version-adapter` 範例改為 `V26_2` / `V26_3` adapter，版本偵測改比對 `major.minor`
- `AttributeUtil.removeModifier(..., UUID)` 已移除，modifier id 一律為 `Identifier`（#14）
- `ScoreboardManager.apply()` / `setLine()` / `removeLine()` / `remove()` 現在會實際送出計分板封包（原本 `apply()` 不會讓 sidebar 顯示）（#14）

#### Added

- `CustomMenuHolder` 範本：作為 container owner，讓 `InventoryClickEvent` 能辨識自訂 GUI；`CustomMenu` 新增 `(syncId, inventory, CustomMenuHolder)` 建構子（#14）
- Web：以 `node:test` + `tsx` 撰寫的 characterization tests（`npm test`），CI 於 push 與 PR 執行（新增 `.github/workflows/ci.yml`）（#14）
- `CHANGELOG.md`；README 新增依賴說明
- 多語 README：简体中文、日本語、한국어、Español、Português (BR)、Русский，各 README 頂端提供語言切換列

#### Changed

- 所有 SKILL.md 範本 class 經 dev bundle 實際編譯驗證（26.2：42 個 class 0 錯誤）；docs／examples 片段經自動包裝編譯檢查（#14、#15）
- `Skills/paper-nms/PLATFORM.md`：版本對照表、`api-version: '26.2'`、Javadoc 26.2、1.21 → 26.x 遷移重點（#15）
- Paperweight userdev 1.7.2 → `2.0.0-beta.24`（需 Gradle 8.11.2+）（#14）
- 10 個先前僅存在 `Skills/` 的技能同步至 `.claude/skills/`；CLAUDE.md 移除不存在的 `AGENTS.md` / `.agents/` 描述（#14）
- Web 依賴：Next.js 16.1.6 → 16.4.0、React 19.2.3 → 19.3.0、TypeScript 5.9.3 → 6.0.3、Tailwind 4.2 → 4.3.3、fuse.js 7.1 → 7.5、`@types/node` ^20 → ^24（#14）
- CI：Node 20 → 24；GitHub Actions 升至 checkout@v7、setup-node@v7、configure-pages@v6、cache@v6、upload-pages-artifact@v5、deploy-pages@v5（#14）
- robots.txt / sitemap.xml 統一由 `app/robots.ts`、`app/sitemap.ts` 產生，sitemap 新增 `/guide`（#14）
- Web 技能頁的範例程式碼對齊範本實際 API（#14、#15）

#### Fixed

- 範本 import 不存在的 `org.bukkit.craftbukkit.v1_21_R1`（Paper 1.20.5+ 已無版本號 relocation）（#14）
- 物品 NBT 改用 `DataComponents.CUSTOM_DATA`；玩家頭顱改用 `DataComponents.PROFILE`（#14）
- `nms-reflection-bridge`：`MethodHandleCache` 會往父類查找方法／欄位（原本 `send()` 在執行期找不到）（#14）
- PLATFORM.md 範本無條件 `dependsOn 'shadowJar'` 導致未套用 shadow 時 `assemble` 失敗（#14）
- `vercel.json` 的 `outputDirectory` 改為 `out`（#14）
- 文件中錯誤的類名與 API：`ClientboundExplodePacket`、`ClientboundDisconnectPacket` 套件、`CraftItemStack.unwrap()`、`ServerboundInteractPacket` 等（#14、#15）

#### Security

- 修補 Next.js critical（request smuggling 等）與 sharp、postcss、js-yaml、nanoid、source-map-js 等 high／moderate 漏洞；`npm audit` 由 12 個（1 critical）降至 4 個 moderate（`sprintf-js`，上游無修補）（#14）
- 技能 Markdown 改用 remark-html 預設 sanitize；`getSkillBySlug` 只接受 kebab-case slug，防止路徑穿越（#14）

#### Removed

- 未使用的依賴：`rehype-autolink-headings`、`rehype-highlight`、`rehype-slug`、`reading-time`（#14）
- `web/scripts/generate-static-metadata.ts` 與提交在 repo 中的 `public/robots.txt`、`public/sitemap.xml`（#14）

## [6.0.0] - 2026-05-01

### Added

- 新增 10 個 NMS 技能（nbt-manipulation、custom-menu、scoreboard、player-profile、particle-effect、attribute-modifier、block-entity、data-component、chunk-access、boss-event），共 15 個（PR #12）
- Web：zh-TW / EN 語言切換、英文標題翻譯與樣式更新（PR #13，2026-05-23，未變更 registry 版號）
