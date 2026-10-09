# MJP-Paper-Skills — NMS API 參考文件

此資料夾存放 MJP-Paper-Skills 所有 NMS API 速查表與深度參考文件。

> **開發者注意**：Cursor Agent 實際載入的 Skill 路徑為 `.cursor/skills/`，本目錄為同步鏡像，供瀏覽器 / GitHub 直接閱讀使用。兩處內容需保持一致。

---

## 目錄結構

```
Skills/
├── README.md                              ← 本文件
├── skills-registry.yml                    ← Skills 索引（含 category / inputs / outputs）
│
├── spigot-paper-api-caller/               ✅ 已建立
│   ├── SKILL.md
│   └── api-reference.md
│
├── generate-plugin-skeleton/              ✅ 已建立
│   ├── SKILL.md
│   └── examples.md
│
├── generate-config-yml/                   ✅ 已建立
│   ├── SKILL.md
│   └── examples.md
│
├── generate-command-handler/              ✅ 已建立
│   ├── SKILL.md
│   └── examples.md
│
├── generate-event-listener/               ✅ 已建立
│   ├── SKILL.md
│   └── examples.md
│
├── generate-test-suite/                   ✅ 已建立
│   ├── SKILL.md
│   └── examples.md
│
├── generate-cicd-workflow/                ✅ 已建立
│   ├── SKILL.md
│   └── examples.md
│
├── generate-database-manager/             ✅ 已建立
│   ├── SKILL.md
│   └── examples.md
│
├── generate-placeholder-expansion/        ✅ 已建立
│   ├── SKILL.md
│   └── examples.md
│
├── generate-permission-system/            ✅ 已建立
│   ├── SKILL.md
│   └── examples.md
│
└── generate-message-system/               ✅ 已建立
    ├── SKILL.md
    └── examples.md
```

---

## Skills 一覽

| # | Skill ID | 功能說明 | 類別 | 狀態 |
|---|----------|----------|------|------|
| 01 | [spigot-paper-api-caller](spigot-paper-api-caller/SKILL.md) | 產生正確的 Spigot/Paper Java API 調用代碼 | integration | ✅ |
| 02 | [generate-plugin-skeleton](generate-plugin-skeleton/SKILL.md) | 產生完整 Maven 插件骨架（pom.xml、plugin.yml、主類） | scaffold | ✅ |
| 03 | [generate-config-yml](generate-config-yml/SKILL.md) | 依功能清單產生結構化 config.yml + ConfigManager | config | ✅ |
| 04 | [generate-command-handler](generate-command-handler/SKILL.md) | 產生 CommandExecutor + TabCompleter 處理類 | command | ✅ |
| 05 | [generate-event-listener](generate-event-listener/SKILL.md) | 產生 Event Listener 骨架 | event | ✅ |
| 06 | [generate-test-suite](generate-test-suite/SKILL.md) | 產生 JUnit5 + MockBukkit 測試套件 | testing | ✅ |
| 07 | [generate-cicd-workflow](generate-cicd-workflow/SKILL.md) | 產生 GitHub Actions CI/CD workflow | devops | ✅ |
| 08 | [generate-database-manager](generate-database-manager/SKILL.md) | 產生 SQLite/MySQL + HikariCP DatabaseManager 類 | database | ✅ |
| 09 | [generate-placeholder-expansion](generate-placeholder-expansion/SKILL.md) | 產生 PlaceholderAPI Expansion 類 | integration | ✅ |
| 10 | [generate-permission-system](generate-permission-system/SKILL.md) | 產生 PermissionManager + plugin.yml 權限節點宣告 | permission | ✅ |
| 11 | [generate-message-system](generate-message-system/SKILL.md) | 產生 messages.yml + MessageManager（MiniMessage 支援） | config | ✅ |

---

## Skill 目錄規範

每個 Skill 目錄包含以下檔案：

| 檔案 | 必要 | 說明 |
|------|------|------|
| `SKILL.md` | ✅ | Skill 主文件（含 YAML frontmatter、輸入/輸出規格、產生步驟） |
| `examples.md` | ✅ | 具體輸入/輸出範例，幫助 AI 理解使用情境 |
| `api-reference.md` | 選用 | 詳細 API 參考（適用於 API caller 類 Skill） |

**`examples.md` 格式：**
```markdown
## 範例 1：[場景描述]

**Input:**
（列出具體的輸入參數）

**Output — [產出檔名]:**
（展示完整或節錄的輸出代碼）
```

---

## 新增 Skill 流程

1. 在此資料夾下建立新目錄（小寫英文 + 連字號命名）
2. 同步在 `.cursor/skills/` 建立相同目錄
3. 撰寫 `SKILL.md`（含 YAML frontmatter：`name`、`description`、`version`）
4. 撰寫 `examples.md`（至少 2 個具體範例）
5. 更新 `.cursor/skills/skills-registry.yml`（含 `category`、`inputs`、`outputs`）

## Skill 狀態說明

| 狀態 | 說明 |
|------|------|
| `active` | 已建立且可使用 |
| `planned` | 規劃中，尚未建立 |
| `deprecated` | 已棄用，請改用替代 Skill |
