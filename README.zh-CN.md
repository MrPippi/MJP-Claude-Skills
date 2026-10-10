<div align="center">

# MJP-Paper-Skills

**经过编译验证的 Minecraft Paper 插件开发 Agent Skills**

使用 Mojang 官方命名的底层 NMS 与纯 Paper API，适用于任何能读取 `SKILL.md` 的 AI 编程工具

[![Paper](https://img.shields.io/badge/Paper-1.21.11%20%7C%2026.2-2ea44f)](https://papermc.io)
[![Java](https://img.shields.io/badge/Java-21%20%7C%2025-orange)](https://adoptium.net)
[![Skills](https://img.shields.io/badge/skills-31-blue)](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)
[![Agent Skills](https://img.shields.io/badge/format-Agent%20Skills-8a63d2)](https://agentskills.io)
[![Skills compile](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml/badge.svg)](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml)
[![License: MIT](https://img.shields.io/github/license/MrPippi/MJP-Paper-Skills)](LICENSE)

[**文档网站**](https://mrpippi.github.io/MJP-Paper-Skills) · [**技能目录**](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills) · [**版本更新记录**](CHANGELOG.md)

[English](README.md) · [繁體中文](README.zh-TW.md) · 简体中文 · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)

</div>

---

AI 编程工具经常在 Paper 插件上出现细微错误：过时或已混淆的 NMS 名称、在 Netty 或异步线程中调用 Bukkit、跨版本变动的 API。MJP-Paper-Skills 为你的代理提供一套经过审核的做法。每个技能都是一份 `SKILL.md`，包含代码模板、构建配置、线程规则与失败回退，代理会在编写代码前先读取。

## 亮点

- **经过编译验证**：CI 会在每次变更时，针对 Paper **1.21.11** 和 **26.2** 编译每个完整模板；版本专属的行会在行内标注。
- **Mojang 官方名称**：NMS 代码使用 Paperweight userdev，以及 Minecraft 自 26.1 起以未混淆形式发布的名称。
- **线程安全的设计**：每个技能都会说明每次调用在哪个线程执行（主线程、Netty IO 或异步）。
- **不限工具**：开放的 [Agent Skills](https://agentskills.io) 格式可用于 Claude Code、OpenAI Codex、Cursor、GitHub Copilot、Gemini CLI 等工具。
- **两条路线**：16 个处理底层工作的 NMS 技能，以及 15 个只需 `paper-api` 的 Paper API 技能。
- **易读的文档**：每个技能也发布在[文档网站](https://mrpippi.github.io/MJP-Paper-Skills)上，提供英文和繁体中文版本。

## 目录

- [快速开始](#快速开始)
- [技能目录](#技能目录)
- [工作原理](#工作原理)
- [兼容性](#兼容性)
- [仓库结构](#仓库结构)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 快速开始

### 1. 安装技能

使用 [skills CLI](https://github.com/vercel-labs/skills) 直接从本仓库安装。只需要 [Node.js](https://nodejs.org)（用于 `npx`），不需要账号或注册。

1. 在你的插件项目根目录运行：

   ```bash
   npx skills add MrPippi/MJP-Paper-Skills
   ```

2. 选择要安装的技能。CLI 会检测你的 AI 工具（Claude Code、Codex、Cursor……），询问要为哪些工具安装，以及使用符号链接（推荐）还是复制。
3. 使用 `npx skills list` 确认结果。

每个技能都把所需的构建配置和线程规则打包在自己的 `references/` 文件夹中，因此单独安装一个技能也能工作。

| 目标 | 命令 |
|------|---------|
| 列出可用的技能 | `npx skills add MrPippi/MJP-Paper-Skills --list` |
| 安装单个技能 | `npx skills add MrPippi/MJP-Paper-Skills --skill paper-dialog-ui` |
| 为指定工具安装全部技能，不再询问 | `npx skills add MrPippi/MJP-Paper-Skills --skill '*' -a claude-code codex -y` |
| 安装到所有项目（例如 `~/.claude/skills/`） | 在任何 `add` 命令后加上 `-g` |
| 更新已安装的技能 | `npx skills update` |
| 移除技能 | `npx skills remove paper-dialog-ui` |

<details>
<summary>手动安装</summary>

将 `MJP-Paper-Skills/.claude/skills/` 复制到你的 AI 工具加载技能的文件夹：

| 工具 | 常见项目路径 |
|------|---------------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex、Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # adjust the target for your tool
```

</details>

> [!NOTE]
> 技能路径因工具和版本而异，请查阅你所用工具的文档。许多工具也会将 `.agents/skills/` 当作共享位置读取。

**工具不支持 Agent Skills？** 在它的指令文件（`AGENTS.md`、`.cursorrules`、`.github/copilot-instructions.md` 等）中指向这些技能：

```markdown
Before writing Paper plugin code, find the matching skill in <skills-folder>/skills-registry.yml
(by trigger_keywords) and follow its SKILL.md, plus the files in its references/ folder.
```

### 2. 说出你的需求

用自然语言描述你想要的功能。工具会将你的请求与每个技能的描述和触发关键词进行匹配：

```text
“用数据包向玩家发送 Action Bar 消息”
“拦截 ServerboundChatPacket 并过滤特定词汇”
“创建一个带有自定义追击 AI 的自定义 Zombie 实体”
“显示只有该玩家能看到的世界边界”
```

---

## 技能目录

共 31 个技能，均已针对 Paper 1.21.11 和 26.2 完成编译验证。可在[文档网站](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)按条件筛选并查看完整模板；机器可读的索引为 [`Skills/skills-registry.yml`](Skills/skills-registry.yml)。

### NMS（16 个技能，需要 Paperweight userdev）

| 类别 | 技能 | 功能 |
|----------|-------|--------------|
| 数据包 | [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | 向单个玩家、一组玩家或所有人发送自定义 Clientbound 数据包 |
| 数据包 | [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | 在 Netty pipeline 中拦截并修改数据包 |
| 实体 | [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | 带有 PathfinderGoal AI 的自定义 NMS 实体 |
| 实体 | [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | 使用 AttributeMap 和 AttributeModifier 动态调整属性 |
| 玩家 | [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | 注入 GameProfile 皮肤，作为 NPC 外观 |
| 玩家 | [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | 没有客户端的 ServerPlayer 假玩家（机器人） |
| 数据 | [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | 读写物品、实体和方块实体上的 CompoundTag NBT |
| 数据 | [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | DataComponentType 物品组件 |
| 世界 | [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | 具备 NBT、Tick 和客户端同步的自定义方块实体 |
| 世界 | [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | 直接访问 LevelChunk 和 ChunkSection 方块 |
| 世界 | [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | 通过 ClientboundLevelParticlesPacket 产生粒子效果 |
| 显示 | [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | 计分板、Objective 和 Team |
| 显示 | [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | 使用 ServerBossEvent 为每位玩家独立控制的 Boss 血条 |
| 界面 | [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | 基于 AbstractContainerMenu 构建的容器 GUI |
| 桥接 | [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | 不依赖 Paperweight、通过反射访问 NMS |
| 桥接 | [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | 支持多版本 NMS 的适配器模式 |

### Paper API（15 个技能，只需 `paper-api`）

| 类别 | 技能 | 功能 |
|----------|-------|--------------|
| 界面 | [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | 回调在主线程执行的 Dialog API 界面 |
| 界面 | [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | 带分页和点击防护的 InventoryHolder 箱子 GUI |
| 数据 | [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | 带 `user_version` 迁移和单一写入线程的 SQLite Repository |
| 数据 | [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | 不可变配置对象、配置文件版本管理和 MiniMessage 语言文件 |
| 集成 | [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | 通过 ServicesManager 提供跨插件 API |
| 集成 | [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | Vault 和 PlaceholderAPI 的软依赖 Hook |
| 集成 | [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | 绑定 localhost、带限流的内嵌 JSON HTTP API |
| 集成 | [`paper-discord-bridge`](Skills/paper/paper-discord-bridge/SKILL.md) | 仅用 JDK 的 Discord 双向聊天桥接：webhook 外发、Gateway 接收 |
| 网络 | [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | 使用 PacketEvents 或 ProtocolLib 过滤数据包 |
| 网络 | [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | 每位玩家独立的世界边界、时间、天气和隐藏玩家 |
| 玩法 | [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | PvP 战斗标记，含伤害归属和战斗中下线处理 |
| 玩法 | [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | 安全落点搜索、随机传送、异步传送和冷却 |
| 玩法 | [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | 多币种账本、托管和 Vault 经济提供者 |
| 命令 | [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | 通过 `LifecycleEvents.COMMANDS` 注册的 Brigadier 命令 |
| 世界 | [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | 用完即弃的世界和竞技场重置 |

---

## 工作原理

```text
Your request ──▶ skill description ──▶ SKILL.md ──▶ references/ ──▶ Generated code
                 (trigger keywords)     (template,     (build.gradle,
                                        inputs,        paper-plugin.yml,
                                        fallbacks)     threading, naming)
```

1. 代理通过技能的描述和触发关键词，将你的请求匹配到某个技能。
2. 它会读取该技能的 `SKILL.md`（模板、输入、输出、线程安全说明、失败回退）和 `examples.md`。
3. 它会应用 `references/` 中打包的平台构建配置，内容由 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 或 [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md) 生成。
4. 它会遵循 `references/` 中打包的线程和 Mojang 命名规则，内容由 [`Skills/_shared/`](Skills/_shared) 生成。

如需模板之外的 API，请参阅 [NMS 速查表](docs/paper-nms)，内容涵盖数据包、实体、Netty pipeline 以及 Bukkit ↔ NMS 桥接。

---

## 兼容性

| 项目 | 支持范围 |
|------|-----------|
| Minecraft / Paper | 1.21.11 和 26.2（模板默认使用 26.2；1.21.11 的差异以 `// @1.21.11:` 标注） |
| Paper dev bundle | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| Java | 21 (1.21.11) / 25 (26.2) |
| 构建 | Gradle 8.11.2+（已验证 9.8.1），Groovy DSL |
| Paperweight userdev | `2.0.0-beta.24`（仅 NMS 技能；无需 `reobfJar`） |
| Shadow（可选） | `com.gradleup.shadow` `9.6.1`，用于多模块构建（`nms-version-adapter`） |
| 软依赖 | VaultAPI 1.7.1、PlaceholderAPI 2.11.6、packetevents 2.13.0、ProtocolLib 5.3.0、sqlite-jdbc 3.49.1.0 |

标准的 `build.gradle` 和 `paper-plugin.yml` 模板位于两份 `PLATFORM.md` 中。从 1.21.x 模板升级？请参阅 [CHANGELOG.md](CHANGELOG.md) 和 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 第 5 节。

---

## 仓库结构

```text
MJP-Paper-Skills/
├── .claude/skills/           # 可直接复制的技能文件夹（镜像 Skills/，PLATFORM 文件夹除外）
├── Skills/                   # 技能的标准来源
│   ├── skills-registry.yml   # 全部 31 个技能的索引（paper-nms + paper-api）
│   ├── _shared/              # 所有技能共用的线程与命名规则
│   ├── paper-nms/PLATFORM.md # NMS build.gradle / paper-plugin.yml 模板、版本表
│   ├── paper-api/PLATFORM.md # Paper API 构建配置、软依赖坐标
│   ├── nms/<skill-id>/       # SKILL.md + examples.md + references/（16 个 NMS 技能）
│   └── paper/<skill-id>/     # SKILL.md + examples.md + references/（15 个 Paper API 技能）
├── scripts/                  # sync-skill-references.mjs（references/）、extract-skill-java.mjs（编译检查）
├── verify/                   # 为各版本编译所提取模板的 Gradle 项目
├── docs/paper-nms/           # NMS API 速查表
├── web/                      # Next.js 文档站（静态导出至 GitHub Pages）
├── CHANGELOG.md
└── CLAUDE.md                 # 面向在本仓库工作的 AI 代理的维护者指令
```

---

## 贡献指南

欢迎贡献。添加新技能的步骤：

1. 创建 `Skills/nms/<slug>/` 或 `Skills/paper/<slug>/`，包含 `SKILL.md` 和 `examples.md`（至少两个示例）。
2. 镜像到 `.claude/skills/` 下的相同路径，然后运行 `node scripts/sync-skill-references.mjs` 生成其 `references/` 文件夹（每当 `PLATFORM.md` 或 `_shared/` 文件变更时重新运行）。
3. 将条目添加到两份 `skills-registry.yml` 中。
4. 添加网站页面 `web/data/skills/<slug>.md` 及其英文正文 `web/data/skills/en/<slug>.md`，然后更新 `web/tests/skills-api.data.test.ts` 中的预期列表。
5. 确认模板可针对 Paper 1.21.11 和 26.2 编译。每个涉及 `Skills/` 的 Pull Request，CI 都会运行此检查；如需在本地运行（26.2 用 JDK 25，1.21.11 用 JDK 21）：

   ```bash
   node scripts/extract-skill-java.mjs 26.2
   cd verify && ./gradlew compileSkills -Pmc=26.2
   ```

完整流程与仓库不变量记录在 [`CLAUDE.md`](CLAUDE.md) 中。如需开发文档网站：

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI 会在每个 Pull Request 上运行相同的检查。网站的技术栈和脚本请见 [`web/README.md`](web/README.md)。

---

## 许可证

[MIT](LICENSE) © MrPippi

非 Minecraft 官方产品。未经 Mojang 或 Microsoft 批准，也与其无关。
