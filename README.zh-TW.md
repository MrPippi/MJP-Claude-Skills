# MJP-Paper-Skills — Minecraft Paper Agent Skills

**經編譯驗證的 [Agent Skills](https://agentskills.io)，專為 Minecraft Paper 1.21.11 / 26.x 插件開發設計：涵蓋採用 Mojang 官方命名的底層 NMS（net.minecraft.server），以及純 Paper API。**

每個技能都是一份 `SKILL.md`，你的 AI 程式設計工具會在產生插件程式碼前先讀取它。這些技能採用開放的 Agent Skills 格式，因此可搭配 Claude Code、OpenAI Codex、Cursor、GitHub Copilot、Gemini CLI，以及任何會載入 `SKILL.md` 的工具。不支援技能的工具仍可引用這些檔案，而且每個技能都可以直接當作一般參考文件閱讀。

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> 文件網站：**[mrpippi.github.io/MJP-Paper-Skills](https://mrpippi.github.io/MJP-Paper-Skills)** · 版本變更紀錄：[CHANGELOG.md](CHANGELOG.md)

---

## 平台資訊

| 項目 | 說明 |
|------|------|
| **MC 版本** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **NMS 命名** | Mojang 官方名稱（Minecraft 自 26.1 起不再混淆） |
| **建置工具** | Gradle 8.11.2+（已驗證 9.8.1）+ Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **技能格式** | [Agent Skills](https://agentskills.io)（`SKILL.md` + YAML frontmatter） |

> 從 1.21.x 版範本升級？請參考 [CHANGELOG.md](CHANGELOG.md) 與 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 第 5 節的遷移說明。

---

## 技能

共 30 個技能，分為兩條路線，皆已針對 Paper 1.21.11 與 26.2 編譯驗證：

- **NMS**（16 個技能，`Skills/nms/`）：封包、Netty 攔截、自定義實體、NBT／資料組件、GUI、計分板、Boss Bar、粒子、區塊、假玩家、反射式存取與多版本 Adapter。需要 Paperweight userdev。
- **Paper API**（14 個技能，`Skills/paper/`）：Dialog、箱子 GUI、SQLite、設定與語言檔、跨插件 API、軟依賴、封包過濾器、PvP 與經濟玩法、Brigadier 指令、用完即棄的世界。只需 `paper-api`。

👉 **瀏覽完整目錄，可依平台與類別篩選：[mrpippi.github.io/MJP-Paper-Skills/docs/skills](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)**

機器可讀的索引（ID、觸發關鍵字、輸入與輸出）位於 [`Skills/skills-registry.yml`](Skills/skills-registry.yml)。

---

## 快速開始

### 1. 安裝技能

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
```

將 `MJP-Paper-Skills/.claude/skills/` 複製到你的 AI 工具載入技能的資料夾：

| 工具 | 常見專案路徑 |
|------|--------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex、Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # 請依你的工具調整目標路徑
```

> 技能路徑會因工具與版本而異，請查閱你所用工具的文件。許多工具會將 `.agents/skills/` 當作共用位置讀取。

**使用的工具不支援 Agent Skills？** 請在它的指令檔（`AGENTS.md`、`.cursorrules`、`.github/copilot-instructions.md`……）中指向這些技能：

```markdown
撰寫 Paper 插件程式碼之前，請先依 trigger_keywords 在 <skills-folder>/skills-registry.yml
中找出對應的技能，並遵循其 SKILL.md，以及它所引用的 PLATFORM.md 與 _shared/ 說明。
```

### 2. 使用技能

用白話描述你的需求；工具會將你的請求與每個技能的描述及觸發關鍵字進行比對：

```
"用封包發送 Action Bar 訊息給玩家"
"攔截 ServerboundChatPacket 並過濾特定詞彙"
"建立一個有自己追蹤 AI 的自定義 Zombie 實體"
```

代理會先讀取對應的 `SKILL.md`、平台設定（[`PLATFORM.md`](Skills/paper-nms/PLATFORM.md)）與共享的執行緒／命名說明，再產生程式碼。

---

## 依賴說明

### 以技能產生的插件

| 依賴 | 版本 | 說明 |
|------|------|------|
| Paper 伺服器 | 1.21.11 / 26.2 | 範本以 build 132 編譯驗證 |
| Paper dev bundle（`paperweight.paperDevBundle`） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | 26.x 格式：`<mc>.build.<n>-<channel>`（[版本列表](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)） |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | 預發布版本；不需 `reobfJar` |
| Gradle | 8.11.2+ | 已驗證 9.8.1 |
| JDK | 25 | toolchain 與 `options.release` |
| `com.gradleup.shadow`（選用） | `9.6.1` | 僅多模組／打包建置時需要（見 `nms-version-adapter`） |
| `paper-api`（純反射／core 模組） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

標準 `build.gradle` 與 `paper-plugin.yml` 位於 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)（NMS 技能）與 [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md)（Paper API 技能，含軟依賴座標：VaultAPI 1.7.1、PlaceholderAPI 2.11.6、packetevents 2.13.0、ProtocolLib 5.3.0、sqlite-jdbc 3.49.1.0）。

### 文件網站（`web/`）

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3，完整清單與指令見 [`web/README.md`](web/README.md)。

---

## 倉庫結構

```
MJP-Paper-Skills/
├── .claude/skills/           ← 可直接複製的技能資料夾（鏡像 Skills/，PLATFORM 資料夾除外）
├── Skills/                   ← 技能的規範來源
│   ├── skills-registry.yml   ← 30 個技能（paper-nms + paper-api）
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md, paper-threading.md
│   ├── paper-nms/PLATFORM.md ← NMS build.gradle / paper-plugin.yml 範本、版本對照表
│   ├── paper-api/PLATFORM.md ← Paper API build.gradle、軟依賴座標
│   ├── nms/<skill-id>/       ← SKILL.md + examples.md（16 個 NMS 技能）
│   └── paper/<skill-id>/     ← SKILL.md + examples.md（14 個 Paper API 技能）
├── docs/paper-nms/           ← NMS API 速查表（封包、實體、網路、橋接）
├── web/                      ← Next.js 文件網站（靜態匯出 → GitHub Pages）
├── .github/workflows/        ← ci.yml（PR 檢查）、nextjs.yml（部署）、Claude workflows
├── CHANGELOG.md
└── CLAUDE.md                 ← 供在此倉庫工作的 AI 代理使用的維護者指引
```

---

## 開發

```bash
cd web
npm ci
npx tsc --noEmit   # 型別檢查
npm test           # characterization tests (node:test + tsx)
npm run build      # 靜態匯出至 web/out/
```

每個 Pull Request 都會由 CI（`.github/workflows/ci.yml`）執行相同檢查。

---

## 新增技能

1. 在 `Skills/nms/<slug>/` 或 `Skills/paper/<slug>/` 建立 `SKILL.md` + `examples.md`（至少 2 個範例）
2. 同步至 `.claude/skills/` 下的相同路徑
3. 在兩份 `skills-registry.yml` 加入新條目
4. 新增 `web/data/skills/<slug>.md`，並更新 `web/tests/skills-api.data.test.ts` 的預期清單
5. 合併前以 Paper 1.21.11 與 26.2 編譯驗證範本 class

完整 9 步流程與不變式見 `CLAUDE.md`。

---

## 授權

MIT
