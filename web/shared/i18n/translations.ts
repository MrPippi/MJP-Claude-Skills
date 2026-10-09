import type { Language, Translations } from './types';
import { GITHUB_REPO_URL, GITHUB_CONTRIBUTE_URL } from '@/config/site';

const zhTW: Translations = {
  nav: {
    skills: 'Skills',
    categories: '分類',
    guide: '使用方法',
  },
  header: {
    searchPlaceholder: '搜尋 Skills...',
    searchAriaLabel: '搜尋 Skills',
    menuAriaLabel: '選單',
  },
  footer: {
    description: 'Paper 1.21.11 / 26.x 插件開發的 Claude Code Agent Skills 函式庫：NMS 底層技能與純 Paper API 技能，皆經雙版本編譯驗證。',
    nav: '導覽',
    resources: '資源',
    home: '首頁',
    allSkills: '所有 Skills',
    categoriesBrowse: '分類瀏覽',
    howToUse: '使用方法',
    githubProject: 'GitHub 專案',
    contributeGuide: '貢獻指南',
    license: '授權條款',
    builtWith: 'Built with Claude Code Agent Skills',
  },
  home: {
    openSource: 'Open Source · Claude Code Agent Skills',
    heroDescription:
      'Paper 1.21.11 / 26.x 插件開發的 Claude Code Agent Skills 函式庫——NMS 底層（封包、自定義實體、假玩家）與純 Paper API（Dialog、SQLite、跨插件 API、封包過濾、PvP 玩法）兩大類技能。',
    browseAllSkills: '瀏覽所有 Skills',
    statsSkills: '個 Skills',
    statsPublished: '個已發布',
    statsCategories: '個分類',
    featuredLabel: '精選',
    featuredTitle: '最常用的 Skills',
    featuredSubtitle: '最完整且使用率最高的工具集',
    viewAll: '查看全部',
    categoriesLabel: '分類',
    categoriesTitle: '依分類瀏覽',
    categoriesSubtitle: '快速找到你需要的開發工具',
    categoryCount: '{count} 個',
    ctaTitle: '想要貢獻新的 Skill？',
    ctaDescription: '歡迎 Fork 本專案，按照規範新增 NMS Skill 並送出 Pull Request。詳細說明請見',
    ctaDescriptionLink: 'GitHub 專案',
    ctaButton: '查看貢獻指南',
  },
  skills: {
    pageLabel: 'Skills',
    pageTitle: '所有 Skills',
    pageSubtitle: '共 {count} 個 Skills',
    filterAll: '全部',
    gridView: '格線視圖',
    listView: '列表視圖',
    emptyState: '目前沒有符合條件的 Skills',
  },
  categories: {
    pageLabel: '分類',
    pageTitle: '分類瀏覽',
    pageSubtitle: '共 {catCount} 個分類 · {skillCount} 個 Skills',
    skillsCount: '{count} 個 Skills',
    activeCount: '{count} 個已發布',
  },
  categoryDetail: {
    breadcrumb: '分類',
    emptyMessage: '此分類目前沒有 Skills',
    subtitle: '{labelEn} · {count} 個 Skills',
  },
  skillDetail: {
    home: '首頁',
    skills: 'Skills',
    toc: '本頁目錄',
    updatedAt: '更新：',
  },
  guide: {
    badge: '使用方法 · 快速上手教學',
    heroTitle: '三步驟開始使用',
    heroTitleHighlight: 'MJP-Claude-Skills',
    heroDescription:
      '透過 Claude Code Agent Skills，只需輸入一句自然語言，即可自動生成完整的 NMS Paper 插件程式碼。以下教學將引導你完成安裝、觸發與使用流程。',
    browseSkills: '瀏覽所有 Skills',
    stepsLabel: '快速上手',
    stepsTitle: '安裝與使用步驟',
    faqLabel: 'FAQ',
    faqTitle: '常見問題',
    faqSubtitle: '找不到答案？歡迎到 GitHub 開 Issue 詢問。',
    ctaTitle: '準備好開始了嗎？',
    ctaDescription: '立即瀏覽所有可用的 Skills，找到最適合你當前開發需求的工具。',
    ctaButtonSkills: '瀏覽所有 Skills',
    ctaButtonContribute: '貢獻指南',
    steps: [
      {
        number: '01',
        title: '安裝 Skills 到專案',
        description:
          '將 MJP-Claude-Skills 的 .claude/skills/ 目錄複製到你的插件專案根目錄，或直接在 Claude Code 中開啟專案以使用 Agent Skills。',
        code: 'git clone https://github.com/MrPippi/MJP-Claude-Skills.git\ncp -r MJP-Claude-Skills/.claude/skills .claude/skills',
        note: '也可以直接 Fork 本專案，以 .claude/skills/ 作為你 Paper 插件專案的 Claude Code Skills 來源。',
        links: [
          { label: '查看 GitHub 專案', href: GITHUB_REPO_URL },
          { label: '瀏覽所有 Skills', href: '/skills' },
        ],
      },
      {
        number: '02',
        title: '在 Claude Code 觸發 Skill',
        description:
          '在 Claude Code 終端機中，用自然語言描述需求，Agent 會自動選擇最匹配的 Skill 並開始生成。',
        triggers: [
          { keyword: '"幫我發送封包"', skill: 'nms-packet-sender' },
          { keyword: '"攔截玩家封包"', skill: 'nms-packet-interceptor' },
          { keyword: '"建立自定義實體"', skill: 'nms-custom-entity' },
          { keyword: '"反射式 NMS 存取"', skill: 'nms-reflection-bridge' },
          { keyword: '"多版本 NMS 相容"', skill: 'nms-version-adapter' },
          { keyword: '"讀寫 NBT 資料"', skill: 'nms-nbt-manipulation' },
        ],
        note: '觸發詞不需要完全相同，Claude Code Agent 會理解語意並自動套用最匹配的 Skill。',
        links: [],
      },
      {
        number: '03',
        title: '取得生成結果',
        description:
          'Skill 執行後會根據你的需求自動生成 Java 類別、build.gradle 依賴設定等完整程式碼，可直接讓 Claude Code 寫入檔案，或複製後手動貼上。',
        outputs: [
          'Java 類別（封包發送器、實體 AI、反射橋接等）',
          'build.gradle Paperweight 依賴設定',
          'paper-plugin.yml 宣告片段',
          'Netty ChannelHandler 管線設定',
          '執行緒安全的 Main thread dispatch 範例',
        ],
        note: '生成的程式碼已包含完整的執行緒安全處理與 Mojang mappings 最佳實踐，可直接作為生產程式碼的基礎。',
        links: [],
      },
    ],
    faqs: [
      {
        q: 'Claude Code 需要什麼版本？',
        a: 'MJP-Claude-Skills 設計用於 Claude Code 的 Agent Skills 系統。請確保已透過 npm install -g @anthropic-ai/claude-code 安裝 Claude Code。Skills 存放於 .claude/skills/，在 Claude Code REPL 或終端機中輸入自然語言即可觸發。',
      },
      {
        q: 'Skills 支援哪些 Minecraft 版本？',
        a: '所有 Skills 的範本都對 Paper 1.21.11 與 26.2 實際編譯驗證。NMS 技能透過 Paperweight userdev 存取；Paper API 技能只需要 paper-api。兩版寫法不同的地方會在程式碼行尾以 // @1.21.11: 標註。',
      },
      {
        q: 'Skills 會自動修改我的檔案嗎？',
        a: '預設情況下，Claude Code 會提出修改建議並等待確認後才寫入檔案。你可以選擇接受或拒絕生成的程式碼。在非互動式 session 中可設定自動套用。',
      },
      {
        q: '如何貢獻新的 Skill？',
        a: 'Fork 本專案後，在 Skills/nms/ 目錄下新增一個資料夾，依照現有 SKILL.md 格式撰寫你的 Skill，同步至 .claude/skills/nms/ 並更新兩邊的 skills-registry.yml。若希望新 Skill 顯示在網站上，需在 web/data/skills/ 建立對應的 .md 資料檔。最後送出 Pull Request 即可。',
      },
    ],
  },
  notFound: {
    title: '找不到頁面',
    description: '找不到這個頁面，可能已移除或路徑輸入有誤。',
    backHome: '回首頁',
  },
  search: {
    placeholder: '搜尋 Skills...',
    emptyHint: '輸入關鍵字搜尋 Skills、標籤或分類...',
    noResults: '找不到「{query}」相關的 Skill',
    navHint: '導覽',
    openHint: '開啟',
    closeHint: '關閉',
  },
  status: {
    active: '已發布',
    deprecated: '已棄用',
  },
  sidebar: {
    categories: '分類',
    allSkills: '全部 Skills',
  },
};

const en: Translations = {
  nav: {
    skills: 'Skills',
    categories: 'Categories',
    guide: 'Guide',
  },
  header: {
    searchPlaceholder: 'Search Skills...',
    searchAriaLabel: 'Search Skills',
    menuAriaLabel: 'Menu',
  },
  footer: {
    description:
      'Claude Code Agent Skills library for Paper 1.21.11 / 26.x plugin development: NMS skills and pure Paper API skills, compile-verified on both versions.',
    nav: 'Navigation',
    resources: 'Resources',
    home: 'Home',
    allSkills: 'All Skills',
    categoriesBrowse: 'Categories',
    howToUse: 'Guide',
    githubProject: 'GitHub Project',
    contributeGuide: 'Contribute',
    license: 'License',
    builtWith: 'Built with Claude Code Agent Skills',
  },
  home: {
    openSource: 'Open Source · Claude Code Agent Skills',
    heroDescription:
      'Claude Code Agent Skills library for Paper 1.21.11 / 26.x plugin development — NMS (packets, custom entities, fake players) and pure Paper API (Dialogs, SQLite, cross-plugin APIs, packet filters, PvP gameplay).',
    browseAllSkills: 'Browse All Skills',
    statsSkills: 'Skills',
    statsPublished: 'Published',
    statsCategories: 'Categories',
    featuredLabel: 'Featured',
    featuredTitle: 'Most Used Skills',
    featuredSubtitle: 'The most complete and widely used toolset',
    viewAll: 'View All',
    categoriesLabel: 'Categories',
    categoriesTitle: 'Browse by Category',
    categoriesSubtitle: 'Quickly find the development tools you need',
    categoryCount: '{count}',
    ctaTitle: 'Want to contribute a new Skill?',
    ctaDescription:
      'Fork this repo, add a new NMS Skill following the spec, and submit a Pull Request. See',
    ctaDescriptionLink: 'GitHub Project',
    ctaButton: 'Contribution Guide',
  },
  skills: {
    pageLabel: 'Skills',
    pageTitle: 'All Skills',
    pageSubtitle: '{count} Skills total',
    filterAll: 'All',
    gridView: 'Grid view',
    listView: 'List view',
    emptyState: 'No Skills match the current filters',
  },
  categories: {
    pageLabel: 'Categories',
    pageTitle: 'Browse by Category',
    pageSubtitle: '{catCount} categories · {skillCount} Skills',
    skillsCount: '{count} Skills',
    activeCount: '{count} published',
  },
  categoryDetail: {
    breadcrumb: 'Categories',
    emptyMessage: 'No Skills in this category yet',
    subtitle: '{labelEn} · {count} Skills',
  },
  skillDetail: {
    home: 'Home',
    skills: 'Skills',
    toc: 'On this page',
    updatedAt: 'Updated: ',
  },
  guide: {
    badge: 'Guide · Quick Start',
    heroTitle: 'Get started with',
    heroTitleHighlight: 'MJP-Claude-Skills',
    heroDescription:
      'Using Claude Code Agent Skills, just type a natural-language prompt to automatically generate complete NMS Paper plugin code. This guide walks you through installation, triggering, and usage.',
    browseSkills: 'Browse All Skills',
    stepsLabel: 'Quick Start',
    stepsTitle: 'Setup & Usage Steps',
    faqLabel: 'FAQ',
    faqTitle: 'Frequently Asked Questions',
    faqSubtitle: "Can't find an answer? Open an issue on GitHub.",
    ctaTitle: 'Ready to get started?',
    ctaDescription: 'Browse all available Skills and find the right tool for your current development needs.',
    ctaButtonSkills: 'Browse All Skills',
    ctaButtonContribute: 'Contribution Guide',
    steps: [
      {
        number: '01',
        title: 'Install Skills into Your Project',
        description:
          'Copy the .claude/skills/ directory from MJP-Claude-Skills into your plugin project root, or open the project directly in Claude Code to use Agent Skills.',
        code: 'git clone https://github.com/MrPippi/MJP-Claude-Skills.git\ncp -r MJP-Claude-Skills/.claude/skills .claude/skills',
        note: 'You can also fork this repo and use .claude/skills/ as the Claude Code Agent Skills source for your Paper plugin project.',
        links: [
          { label: 'View on GitHub', href: GITHUB_REPO_URL },
          { label: 'Browse All Skills', href: '/skills' },
        ],
      },
      {
        number: '02',
        title: 'Trigger a Skill in Claude Code',
        description:
          'In the Claude Code terminal, describe what you need in natural language. The agent auto-selects the best-matching Skill and begins generation.',
        triggers: [
          { keyword: '"send a custom packet"', skill: 'nms-packet-sender' },
          { keyword: '"intercept player packets"', skill: 'nms-packet-interceptor' },
          { keyword: '"create a custom entity"', skill: 'nms-custom-entity' },
          { keyword: '"reflection NMS access"', skill: 'nms-reflection-bridge' },
          { keyword: '"multi-version NMS adapter"', skill: 'nms-version-adapter' },
          { keyword: '"read write NBT data"', skill: 'nms-nbt-manipulation' },
        ],
        note: "Trigger phrases don't need to be exact — Claude Code understands intent and selects the best-matching Skill automatically.",
        links: [],
      },
      {
        number: '03',
        title: 'Use the Generated Code',
        description:
          'After execution, the Skill generates complete Java classes, build.gradle dependencies, and more. Apply them directly via Claude Code or copy-paste manually.',
        outputs: [
          'Java classes (packet sender, entity AI, reflection bridge, etc.)',
          'build.gradle Paperweight dependency blocks',
          'paper-plugin.yml declaration fragments',
          'Netty ChannelHandler pipeline setup',
          'Thread-safe main-thread dispatch examples',
        ],
        note: 'Generated code includes full thread-safety handling and Mojang mappings best practices, ready to use as a production foundation.',
        links: [],
      },
    ],
    faqs: [
      {
        q: 'What version of Claude Code is required?',
        a: 'MJP-Claude-Skills is designed for the Claude Code Agent Skills system. Install Claude Code via npm install -g @anthropic-ai/claude-code. Skills are stored in .claude/skills/ and triggered by typing natural-language prompts in the Claude Code REPL or terminal.',
      },
      {
        q: 'Which Minecraft versions are supported?',
        a: 'Every skill template is compile-verified against Paper 1.21.11 and 26.2. NMS skills use Paperweight userdev; Paper API skills need only paper-api. Lines that differ between the two versions carry an inline // @1.21.11: alternative.',
      },
      {
        q: 'Will Skills modify my files automatically?',
        a: 'By default, Claude Code proposes changes and waits for your confirmation before writing files. You can review, accept, or reject generated code. Automatic application can be enabled in non-interactive sessions.',
      },
      {
        q: 'How do I contribute a new Skill?',
        a: 'Fork this repo, create a new folder under Skills/nms/, write your Skill following the existing SKILL.md format, sync to .claude/skills/nms/, and update both skills-registry.yml files. To show the Skill on the website, also create a .md data file under web/data/skills/. Then submit a Pull Request.',
      },
    ],
  },
  notFound: {
    title: 'Page Not Found',
    description: "This page doesn't exist or may have been moved.",
    backHome: 'Back to Home',
  },
  search: {
    placeholder: 'Search Skills...',
    emptyHint: 'Type to search Skills, tags, or categories...',
    noResults: 'No results for "{query}"',
    navHint: 'Navigate',
    openHint: 'Open',
    closeHint: 'Close',
  },
  status: {
    active: 'Active',
    deprecated: 'Deprecated',
  },
  sidebar: {
    categories: 'Categories',
    allSkills: 'All Skills',
  },
};

export const translations: Record<Language, Translations> = { 'zh-TW': zhTW, en };

export { GITHUB_CONTRIBUTE_URL };
