# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**一套精心整理的 [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) 库，面向 Paper 1.21.11 / 26.x（使用 Mojang 官方命名）的 Minecraft NMS（net.minecraft.server）底层开发。**

MJP-Claude-Skills 提供经过编译验证的 NMS 技能模板，Claude Code 在生成插件代码前会先读取这些模板，涵盖数据包、Netty 拦截、自定义实体、NBT / 数据组件、GUI、计分板、Boss 血条、粒子、区块、基于反射的访问以及多版本适配器。

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> 版本更新记录：[CHANGELOG.md](CHANGELOG.md)

---

## 平台

| 项目 | 详情 |
|------|------|
| **MC 版本** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **NMS 命名** | Mojang 官方名称（自 26.1 起 Minecraft 不再混淆） |
| **构建工具** | Gradle 8.11.2+（已验证 9.8.1）+ Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **技能运行时** | `.claude/skills/`（Claude Code） |

> 从 1.21.x 模板升级？请参阅 [CHANGELOG.md](CHANGELOG.md) 以及 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 第 5 节中的迁移说明。

---

## 技能

| Skill ID | 类别 | 用途 |
|----------|------|------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | 通过 `ServerPlayer.connection.send()` 发送 Clientbound 数据包 |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | 向 Netty pipeline 注入 `ChannelDuplexHandler` 以拦截/修改数据包 |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | 基于 `Goal` AI 的自定义 NMS 生物 |
| [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | nms-entity | 通过 `AttributeModifier` 读取/修改实体属性 |
| [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | nms-data | 通过 `CompoundTag` / `ValueOutput` 处理物品 `custom_data` 与实体 NBT |
| [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | nms-data | 物品 `DataComponentType` 系统（自定义数据、堆叠数量、附魔…） |
| [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | nms-ui | 带有 Bukkit `InventoryHolder` 桥接的 `AbstractContainerMenu` GUI |
| [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | nms-display | 通过计分板数据包实现每位玩家独立的侧边栏与队伍 |
| [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | nms-display | 使用 `ServerBossEvent` 实现每位玩家独立的 Boss 血条 |
| [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | nms-player | 用于 NPC 与玩家头颅的 `GameProfile` 皮肤 |
| [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | nms-world | 使用 `ClientboundLevelParticlesPacket` 发送客户端粒子 |
| [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | nms-world | 支持持久化、Tick 与客户端同步的自定义 `BlockEntity` |
| [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | nms-world | 直接访问 `LevelChunk` / 区段并批量修改方块 |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | 基于 `MethodHandle` 缓存的 NMS 访问，无需 Paperweight 编译依赖 |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | 带运行时分发的多版本适配器接口 |

---

## 快速开始

### 1. 安装技能运行时

将 `.claude/skills/` 复制到你的项目根目录：

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. 使用技能

Claude Code 会自动加载 `.claude/skills/`。使用触发关键词描述你的需求：

```
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

Claude Code 会在生成代码前读取匹配的 `SKILL.md`、[`PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 以及共享的线程/命名说明。

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

标准的 `build.gradle` 与 `paper-plugin.yml` 位于 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)。

### 文档网站（`web/`）

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — 完整列表与脚本见 [`web/README.md`](web/README.md)。

---

## 仓库结构

```
MJP-Claude-Skills/
├── .claude/skills/           ← Claude Code runtime (mirrors Skills/, except paper-nms/)
├── Skills/                   ← Canonical skill sources
│   ├── skills-registry.yml   ← v6.0.0, 15 skills
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md
│   ├── paper-nms/PLATFORM.md ← build.gradle / paper-plugin.yml templates, version table
│   └── nms/<skill-id>/       ← SKILL.md + examples.md (15 skills)
├── docs/paper-nms/           ← NMS API quick reference (packets, entities, network, bridge)
├── web/                      ← Next.js documentation site (static export → GitHub Pages)
├── .github/workflows/        ← ci.yml (PR checks), nextjs.yml (deploy), Claude workflows
├── CHANGELOG.md
└── CLAUDE.md                 ← Instructions for Claude Code in this repo
```

---

## 开发

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # characterization tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI 会在每个 Pull Request 上运行相同的检查（`.github/workflows/ci.yml`）。

---

## 添加新技能

1. 创建 `Skills/nms/<slug>/SKILL.md` + `examples.md`（≥ 2 个示例）
2. 镜像到 `.claude/skills/nms/<slug>/`
3. 将条目添加到两份 `skills-registry.yml`
4. 添加 `web/data/skills/<slug>.md`，并更新 `web/tests/skills-api.data.test.ts` 中的预期列表
5. 合并前，针对当前 dev bundle 编译模板类

完整的 8 步流程与不变量请参见 `CLAUDE.md`。

---

## 许可证

MIT
