# Web Redesign — Implementation Plan

Spec：`docs/superpowers/specs/2026-10-09-web-redesign-design.md`
執行方式：inline（使用者指示「依照建議持續執行直到完成」）。每個任務完成跑 `npx tsc --noEmit && npm test`。

## Task 1 — 依賴
- 加入 `unified remark-parse remark-rehype rehype-sanitize rehype-slug rehype-stringify @shikijs/rehype shiki hast-util-to-string unist-util-visit`
- 移除 `remark remark-html @tailwindcss/typography`

## Task 2 — Markdown 管線（TDD）
- RED：`tests/markdown.test.ts`（raw HTML 被丟、`<script>` 被丟、h2/h3 帶 id 並出現在 headings、java 區塊含 `shiki` class 與 `data-lang="java"`、未知語言不丟錯、`resolveLink` 重寫 href）
- GREEN：`shared/markdown/render.ts`

## Task 3 — Skills API 與平台判定（TDD）
- 更新 `tests/skills-api.fixture.test.ts` 標題 id 期望值、新增 headings 斷言
- RED：`tests/platform.test.ts`
- GREEN：`getSkillBySlug` 改用 `renderMarkdown`；`features/skills/lib/platform.ts`（`getPlatform`、`categoryIconFor`、`groupSkillsByPlatform`）

## Task 4 — Docs API（TDD）
- RED：`tests/docs-api.test.ts`
- GREEN：`features/docs/api/docs.ts` + `features/docs/registry.ts`

## Task 5 — 路由與轉址（TDD）
- RED：`tests/redirects.test.ts`、更新 `tests/metadata-routes.test.ts`
- GREEN：`config/routes.ts`（路由常數與轉址表）、`app/sitemap.ts`、`shared/ui/Redirect.tsx`、舊路由轉址頁、`next.config.mjs` 暴露 `NEXT_PUBLIC_BASE_PATH`

## Task 6 — 視覺基礎
- `app/globals.css`（token、prose、Shiki、像素工具類）、`app/layout.tsx`（字體、主題 inline script）
- `shared/ui/PixelIcon.tsx` + `pixel-icons.ts`、`config/mc-assets.ts`

## Task 7 — 外殼
- `Header`、`Footer`、`ThemeToggle`、`LangToggle`、`AppShell`、`SearchModal` 重新設計（含文件頁結果）

## Task 8 — 文件中心
- `app/docs/layout.tsx`、`DocsShell`、`DocsSidebar`、`Toc`、`DocArticle`、`CopyCodeEnhancer`
- 頁面：`/docs`、`/docs/getting-started`、`/docs/platforms/[slug]`、`/docs/concepts/[slug]`、`/docs/reference/[slug]`、`/docs/skills`、`/docs/skills/[slug]`

## Task 9 — 落地頁與 404
- `HomePageClient`、`HeroScene`、`HeroTerminal`、`NotFoundClient`

## Task 10 — 清理與驗證
- 刪除 `features/categories`、`features/guide`、舊元件；更新 i18n
- `npx tsc --noEmit`、`npm test`、`npm run build`，檢查 `out/` 路由；瀏覽器手動檢查淺/深色與手機寬度
- 更新 `CLAUDE.md` Web App 段落（路由、圖片放置方式）
