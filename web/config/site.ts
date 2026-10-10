export const GITHUB_REPO_URL = 'https://github.com/MrPippi/MJP-Paper-Skills';
/** 貢獻指南：各語言 README 的「貢獻指南」／Contributing 段落 */
export const GITHUB_CONTRIBUTE_URLS = {
  'zh-TW': `${GITHUB_REPO_URL}/blob/main/README.zh-TW.md#貢獻指南`,
  en: `${GITHUB_REPO_URL}/blob/main/README.md#contributing`,
} as const;
/** Short name appended to page titles (matches the metadata title template). */
export const SITE_SHORT_NAME = 'MJP-Paper-Skills';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mrpippi.github.io/MJP-Paper-Skills';
export const SITE_NAME = 'MJP-Paper-Skills — Minecraft Paper Agent Skills';
export const SITE_DESCRIPTION =
  'Paper 1.21.11 / 26.x 插件開發的 AI Agent Skills 函式庫（SKILL.md 開放格式，Claude Code、Codex、Cursor、Copilot 等皆可用）：NMS 底層技能（封包、自定義實體、假玩家）與純 Paper API 技能（Dialog、SQLite、跨插件 API、封包過濾、PvP 玩法），皆經雙版本編譯驗證。';
