# MJP-Paper-Skills — Minecraft Paper Agent Skills

**经过编译验证的 [Agent Skills](https://agentskills.io)，面向 Minecraft Paper 1.21.11 / 26.x 插件开发：使用 Mojang 官方命名的底层 NMS（net.minecraft.server），以及纯 Paper API。**

每个技能都是一份 `SKILL.md`，你的 AI 编程工具会在生成插件代码前先读取它。这些技能采用开放的 Agent Skills 格式，因此可用于 Claude Code、OpenAI Codex、Cursor、GitHub Copilot、Gemini CLI 以及任何能加载 `SKILL.md` 的工具。不支持技能的工具同样可以引用这些文件，每个技能也都可以当作普通参考文档阅读。

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> 文档网站：**[mrpippi.github.io/MJP-Paper-Skills](https://mrpippi.github.io/MJP-Paper-Skills)** · 版本更新记录：[CHANGELOG.md](CHANGELOG.md)

---

## 平台

| 项目 | 详情 |
|------|------|
| **MC 版本** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **NMS 命名** | Mojang 官方名称（自 26.1 起 Minecraft 不再混淆） |
| **构建工具** | Gradle 8.11.2+（已验证 9.8.1）+ Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **技能格式** | [Agent Skills](https://agentskills.io)（`SKILL.md` + YAML frontmatter） |

> 从 1.21.x 模板升级？请参阅 [CHANGELOG.md](CHANGELOG.md) 以及 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)（第 5 节）中的迁移说明。

---

## 技能

共 30 个技能，分为两条路线，均已针对 Paper 1.21.11 和 26.2 完成编译验证：

- **NMS**（16 个技能，`Skills/nms/`）：数据包、Netty 拦截、自定义实体、NBT / 数据组件、GUI、计分板、Boss 血条、粒子、区块、假玩家、反射以及多版本适配器。需要 Paperweight userdev。
- **Paper API**（14 个技能，`Skills/paper/`）：Dialog、箱子 GUI、SQLite、配置与语言文件、跨插件 API、软依赖、数据包过滤器、PvP 与经济玩法、Brigadier 命令、用完即弃的世界。只需 `paper-api`。

👉 **浏览完整目录，可按平台和类别筛选：[mrpippi.github.io/MJP-Paper-Skills/docs/skills](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)**

机器可读的索引（ID、触发关键词、输入与输出）位于 [`Skills/skills-registry.yml`](Skills/skills-registry.yml)。

---

## 快速开始

### 1. 安装技能

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
```

将 `MJP-Paper-Skills/.claude/skills/` 复制到你的 AI 工具加载技能的文件夹：

| 工具 | 常见项目路径 |
|------|--------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex、Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # adjust the target for your tool
```

> 技能路径因工具和版本而异，请查阅你所用工具的文档。`.agents/skills/` 被许多工具当作共享位置读取。

**工具不支持 Agent Skills？** 在它的指令文件（`AGENTS.md`、`.cursorrules`、`.github/copilot-instructions.md` 等）中指向这些技能：

```markdown
编写 Paper 插件代码之前，先在 <skills-folder>/skills-registry.yml 中
（依据 trigger_keywords）找到匹配的技能，并遵循其 SKILL.md，
以及其中引用的 PLATFORM.md 与 _shared/ 说明。
```

### 2. 使用技能

用自然语言描述你的需求；工具会将你的请求与每个技能的描述和触发关键词进行匹配：

```
"用数据包向玩家发送 Action Bar 消息"
"拦截 ServerboundChatPacket 并过滤特定词汇"
"创建一个带有自定义追击 AI 的自定义 Zombie 实体"
```

代理会在生成代码前读取匹配的 `SKILL.md`、平台设置（[`PLATFORM.md`](Skills/paper-nms/PLATFORM.md)）以及共享的线程/命名说明。

---

## 依赖

### 由技能生成的插件

| 依赖 | 版本 | 说明 |
|------|------|------|
| Paper 服务器 | 1.21.11 / 26.2 | 模板已针对 build 132 完成编译验证 |
| Paper dev bundle（`paperweight.paperDevBundle`） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | 26.x 格式：`<mc>.build.<n>-<channel>`（[列表](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)） |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | 预发布版本；无需 `reobfJar` |
| Gradle | 8.11.2+ | 已使用 9.8.1 验证 |
| JDK | 25 | Toolchain 与 `options.release` |
| `com.gradleup.shadow`（可选） | `9.6.1` | 仅用于多模块/打包构建（参见 `nms-version-adapter`） |
| `paper-api`（仅反射 / core 模块） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

标准的 `build.gradle` 与 `paper-plugin.yml` 位于 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)（NMS 技能）和 [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md)（Paper API 技能，含软依赖坐标：VaultAPI 1.7.1、PlaceholderAPI 2.11.6、packetevents 2.13.0、ProtocolLib 5.3.0、sqlite-jdbc 3.49.1.0）。

### 文档网站（`web/`）

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — 完整列表与脚本见 [`web/README.md`](web/README.md)。

---

## 仓库结构

```
MJP-Paper-Skills/
├── .claude/skills/           ← 可直接复制的技能文件夹（镜像 Skills/，PLATFORM 文件夹除外）
├── Skills/                   ← 技能的标准来源
│   ├── skills-registry.yml   ← 30 个技能（paper-nms + paper-api）
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md, paper-threading.md
│   ├── paper-nms/PLATFORM.md ← NMS build.gradle / paper-plugin.yml 模板、版本表
│   ├── paper-api/PLATFORM.md ← Paper API build.gradle、软依赖坐标
│   ├── nms/<skill-id>/       ← SKILL.md + examples.md（16 个 NMS 技能）
│   └── paper/<skill-id>/     ← SKILL.md + examples.md（14 个 Paper API 技能）
├── docs/paper-nms/           ← NMS API 速查表（数据包、实体、网络、桥接）
├── web/                      ← Next.js 文档站（静态导出 → GitHub Pages）
├── .github/workflows/        ← ci.yml（PR 检查）、nextjs.yml（部署）、Claude 工作流
├── CHANGELOG.md
└── CLAUDE.md                 ← 面向在本仓库工作的 AI 代理的维护者指令
```

---

## 开发

```bash
cd web
npm ci
npx tsc --noEmit   # 类型检查
npm test           # characterization tests (node:test + tsx)
npm run build      # 静态导出至 web/out/
```

CI 会在每个 Pull Request 上运行相同的检查（`.github/workflows/ci.yml`）。

---

## 添加新技能

1. 创建 `Skills/nms/<slug>/` 或 `Skills/paper/<slug>/`，包含 `SKILL.md` + `examples.md`（≥ 2 个示例）
2. 镜像到 `.claude/skills/` 下的相同路径
3. 将条目添加到两份 `skills-registry.yml`
4. 添加 `web/data/skills/<slug>.md`，并更新 `web/tests/skills-api.data.test.ts` 中的预期列表
5. 合并前，针对 Paper 1.21.11 和 26.2 编译模板类

完整的 9 步流程与不变量请参见 `CLAUDE.md`。

---

## 许可证

MIT
