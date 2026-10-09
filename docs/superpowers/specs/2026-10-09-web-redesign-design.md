# Web Redesign — Docs Hub（Claude × Code × Minecraft）

日期：2026-10-09 ・ 分支：`claude/web-redesign` ・ 範圍：`web/`

## 1. 目標與共識

使用者原話：網頁設計與排版重新調整及優化；風格 = Claude、程式碼、輕量化、現代化、Minecraft 元素；可提供遊戲內圖片。

已確認決策：

| 項目 | 決策 |
|---|---|
| 主題 | 淺色 + 深色雙模式，預設跟隨系統，可手動切換（localStorage） |
| MC 強度 | 中度點綴：像素字體標籤、像素圖示、像素按鈕陰影、hero 場景圖；內文保持乾淨 |
| 資訊架構 | 方案 C：完整文件中心（`/docs/*`），舊路由全部轉址 |
| 圖片 | 使用者稍後提供 hero 場景截圖（白天/夜晚）與物品圖示；在提供前以自繪 SVG 像素圖替代，提供後只需放檔 + 改設定 |

成功標準：`npx tsc --noEmit`、`npm test`、`npm run build` 全過；所有舊 URL 仍可到達新頁面；手機寬度無水平捲動；首頁無額外大型執行時 JS（語法高亮在建置時完成）。

## 2. 視覺系統

色彩 token 定義於 `app/globals.css` 的 Tailwind v4 `@theme`，深色以 `:root[data-theme="dark"]` 與 `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` 覆寫。

| Token | 淺色 | 深色 | 用途 |
|---|---|---|---|
| `bg` | `#FAF9F5` | `#1F1E1D` | 頁面底 |
| `surface` / `surface-2` | `#F0EEE6` / `#E8E5DA` | `#262624` / `#2E2D2A` | 卡片、側欄 |
| `line` / `line-strong` | `#E3DFD3` / `#CFC9B8` | `#3A3935` / `#4A4843` | 邊框 |
| `fg` / `fg-2` / `fg-3` | `#141413` / `#5E5D59` / `#8A8880` | `#F5F4ED` / `#C2BFB4` / `#8F8C83` | 文字三階 |
| `accent` / `accent-hover` / `accent-deep` | `#C96442` / `#B5573A` / `#8F4129` | `#D97757` / `#E48A6B` / `#9C4A30` | 陶土橘、按鈕像素陰影 |
| `nms` | `#B3352B` | `#E0584C` | 紅石紅（NMS 平台徽章） |
| `api` | `#2E8B57` | `#4CC38A` | 綠寶石綠（Paper API 平台徽章） |
| `code-bg` | `#F3F1EA` | `#191817` | 程式碼區塊 |

字體（`next/font/google`，只載 Latin，CJK 走系統字）：標題 Source Serif 4、內文 Inter、程式碼 JetBrains Mono、像素點綴 Silkscreen（徽章、數字、小標）。

Minecraft 點綴：
- `PixelIcon`：以字元網格定義的 16×16 SVG 像素圖示（草方塊、鎬、紅石、書、箱子、劍、指令方塊、綠寶石、終界珍珠、生怪蛋、玩家頭、告示牌），`shape-rendering: crispEdges`。
- `.btn-pixel`：方角 + `0 4px 0 accent-deep` 硬陰影，`:active` 下沉 4px。
- `.pixel-divider`：階梯狀 SVG 分隔線。
- Hero：`config/mc-assets.ts` 若設定 `hero.day/night` 圖片則顯示（底部漸層融入背景），否則顯示 SVG 像素地景。
- 頁尾 Mojang 品牌規範聲明。

程式碼感：建置時 Shiki（`vitesse-light` / `vitesse-dark` 雙主題）、語言標籤、複製鈕（小型 client 元件）；首頁 hero 右側「終端機」卡片顯示安裝與觸發範例。

## 3. 資訊架構與路由

| 路由 | 內容 | 來源 |
|---|---|---|
| `/` | 落地頁：hero + 終端機、雙平台入口、三步驟、精選技能、速查表入口、貢獻 CTA | 既有資料 |
| `/docs` | 文件總覽（各區塊卡片） | — |
| `/docs/getting-started` | 安裝 → 觸發 → 產出、FAQ | i18n `guide` 文字 |
| `/docs/platforms/{paper-nms,paper-api}` | 平台建置設定 | `../Skills/<p>/PLATFORM.md` |
| `/docs/concepts/{nms-threading,nms-obfuscation,paper-threading}` | 共用概念 | `../Skills/_shared/*.md` |
| `/docs/skills` | 技能瀏覽器：平台、分類、文字篩選（`?platform=`、`?category=`） | `web/data/skills/` |
| `/docs/skills/[slug]` | 技能詳情 | `web/data/skills/<slug>.md` |
| `/docs/reference/{packets,entities,network,bukkit-nms-bridge}` | NMS 速查表 | `../docs/paper-nms/*.md` |

轉址（靜態匯出無伺服器轉址）：`/skills`→`/docs/skills`、`/skills/[slug]`→`/docs/skills/[slug]`、`/categories`→`/docs/skills`、`/categories/[c]`→`/docs/skills?category=c`、`/guide`→`/docs/getting-started`。轉址頁 = `<meta http-equiv="refresh">` + `<link rel="canonical">` + `location.replace` + 可點連結，`robots: noindex`，sitemap 不收錄。

版面：`/docs/*` 共用 `DocsShell` 三欄（左側導覽、內文、右側 TOC）；`< lg` 左側導覽收成抽屜，`< xl` 隱藏 TOC。側欄順序：開始使用、平台、概念、技能（依平台→分類分組）、速查表。

## 4. 資料與 Markdown 管線

- 新 `shared/markdown/render.ts`：`renderMarkdown(md) → { html, headings }`。
  管線：`remark-parse → remark-gfm → remark-rehype → rehype-sanitize(預設 schema) → rehype-slug → 收集 h2/h3 → @shikijs/rehype → rehype-stringify`。消毒在高亮之前，所以原始 HTML 仍被丟棄，Shiki 產生的 style 不受影響。未知語言退回純文字（`gradle` 別名為 `groovy`）。
  選項 `resolveLink(href)` 供文件頁重寫相對連結。
- `features/skills/api/skills.ts`：`getSkillBySlug` 改用 `renderMarkdown`，回傳新增 `headings`；`SkillMeta` 不變。新增純函式 `getPlatform(skill)`（依 `githubPath`/`category` 前綴）。
- 新 `features/docs/api/docs.ts`：固定的文件註冊表（section、slug、repo 相對路徑），讀取 `path.resolve(process.cwd(), '..', file)`；標題取第一個 `# `，以 ` / ` 拆中英；本文移除該 H1。相對 `.md` 連結：目標在註冊表內 → 站內路由，否則 → GitHub blob URL。slug 只接受註冊表內的值。
- 搜尋：技能 Fuse 搜尋不變；搜尋 modal 另外列出符合的文件頁（標題比對）。

## 5. 元件拆分（每檔 < 300 行）

`layout/`：`AppShell`、`Header`、`Footer`、`ThemeToggle`、`LangToggle`、`theme-script.ts`。
`features/docs/components/`：`DocsShell`、`DocsSidebar`、`Toc`、`DocArticle`（標題列 + prose + 上/下一頁）、`DocsIndex`、`GettingStarted`。
`features/skills/components/`：`SkillBrowser`、`SkillCard`、`SkillDetail`、`PlatformBadge`、`SkillBadge`。
`features/home/`：`HomePageClient`、`HeroTerminal`、`HeroScene`。
`shared/ui/`：`PixelIcon`（+ `pixel-icons.ts` 資料）、`CopyCodeEnhancer`、`Redirect`。
移除：`features/categories/*`、`features/guide/*`、`app/categories/*` 的內容頁（改為轉址頁）、`@tailwindcss/typography`、`remark`、`remark-html`。

## 6. 錯誤處理

- 文件來源檔缺失：`getDocPage` 回傳 `null` → `notFound()`；`getAllDocPages` 於建置時遇缺檔直接丟錯並指出路徑（避免默默少頁）。
- localStorage 讀寫包 try/catch；主題 inline script 失敗時退回系統偏好。
- 圖片未設定時顯示 SVG 替代，不產生壞圖。

## 7. 測試

- 更新 characterization：`skills-api.fixture`（標題現在帶 `id`、新增 `headings`）、`metadata-routes`（新 sitemap 結構）。
- 新增：`markdown.test.ts`（消毒、slug、headings、高亮、連結重寫）、`docs-api.test.ts`（註冊表、標題拆分、連結重寫、未知 slug）、`platform.test.ts`（平台判定、分類→圖示）、`redirects.test.ts`（轉址對照）。
- 建置驗證：`tsc`、`test`、`build`，並確認 `out/` 內有全部新舊路由檔。

## 8. 不做（YAGNI）

不加 UI 元件庫、動畫庫、MDX、執行時高亮、全文搜尋文件內容、新語言、音效。
