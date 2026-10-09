# Changelog

本檔記錄 MJP-Claude-Skills 的重要變更，格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。
技能庫版本以 `Skills/skills-registry.yml` 的 `version` 為準。

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
