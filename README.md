# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**A curated library of [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) for low-level Minecraft NMS (net.minecraft.server) development on Paper 26.x with official Mojang names.**

MJP-Claude-Skills provides compile-verified NMS skill templates that Claude Code reads before generating plugin code — covering packets, Netty interception, custom entities, NBT / data components, GUIs, scoreboards, boss bars, particles, chunks, reflection-based access and multi-version adapters.

> 繁體中文說明請見 [README.zh-TW.md](README.zh-TW.md) · Release notes: [CHANGELOG.md](CHANGELOG.md)

---

## Platform

| Item | Details |
|------|---------|
| **MC version** | 26.2 (Paper stable) |
| **Paper dev bundle** | `26.2.build.132-stable` |
| **NMS naming** | Official Mojang names (Minecraft is unobfuscated since 26.1) |
| **Build tool** | Gradle 8.11.2+ (verified 9.8.1) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 25 (toolchain; Paper 26.x minimum) |
| **Skill runtime** | `.claude/skills/` (Claude Code) |

> Upgrading from the 1.21.x templates? See [CHANGELOG.md](CHANGELOG.md) and the migration notes in [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (section 5).

---

## Skills

| Skill ID | Category | Purpose |
|----------|----------|---------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | Send Clientbound packets via `ServerPlayer.connection.send()` |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | Inject a `ChannelDuplexHandler` into the Netty pipeline to intercept/modify packets |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | Custom NMS mobs with `Goal`-based AI |
| [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | nms-entity | Read/modify entity attributes with `AttributeModifier` |
| [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | nms-data | Item `custom_data` and entity NBT via `CompoundTag` / `ValueOutput` |
| [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | nms-data | Item `DataComponentType` system (custom data, stack size, enchantments…) |
| [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | nms-ui | `AbstractContainerMenu` GUIs with a Bukkit `InventoryHolder` bridge |
| [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | nms-display | Per-player sidebars and teams via scoreboard packets |
| [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | nms-display | Per-player boss bars with `ServerBossEvent` |
| [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | nms-player | `GameProfile` skins for NPCs and player heads |
| [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | nms-world | Client-side particles with `ClientboundLevelParticlesPacket` |
| [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | nms-world | Custom `BlockEntity` with persistence, ticking and client sync |
| [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | nms-world | Direct `LevelChunk` / section access and bulk block edits |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | `MethodHandle`-cached NMS access without a Paperweight compile dependency |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | Multi-version adapter interface with runtime dispatch |

---

## Quick Start

### 1. Install the skill runtime

Copy `.claude/skills/` into your project root:

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. Use a skill

Claude Code picks up `.claude/skills/` automatically. Describe what you need with trigger keywords:

```
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

Claude Code reads the matching `SKILL.md`, [`PLATFORM.md`](Skills/paper-nms/PLATFORM.md) and the shared threading/naming notes before generating code.

---

## Dependencies

### Plugins generated from the skills

| Dependency | Version | Notes |
|------------|---------|-------|
| Paper server | 26.2 | Templates are compile-verified against build 132 |
| Paper dev bundle (`paperweight.paperDevBundle`) | `26.2.build.132-stable` | 26.x format: `<mc>.build.<n>-<channel>` ([list](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)) |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | Pre-release; no `reobfJar` needed |
| Gradle | 8.11.2+ | Verified with 9.8.1 |
| JDK | 25 | Toolchain and `options.release` |
| `com.gradleup.shadow` (optional) | `9.6.1` | Only for multi-module / bundled builds (see `nms-version-adapter`) |
| `paper-api` (reflection-only / core modules) | `26.2.build.132-stable` | `compileOnly` |

The canonical `build.gradle` and `paper-plugin.yml` live in [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md).

### Documentation website (`web/`)

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — full list and scripts in [`web/README.md`](web/README.md).

---

## Repository Structure

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

## Development

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # characterization tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI runs the same checks on every pull request (`.github/workflows/ci.yml`).

---

## Adding New Skills

1. Create `Skills/nms/<slug>/SKILL.md` + `examples.md` (≥ 2 examples)
2. Mirror to `.claude/skills/nms/<slug>/`
3. Add the entry to both `skills-registry.yml` files
4. Add `web/data/skills/<slug>.md` and update the expected list in `web/tests/skills-api.data.test.ts`
5. Compile the template classes against the current dev bundle before merging

See `CLAUDE.md` for the complete 8-step process and invariants.

---

## License

MIT
