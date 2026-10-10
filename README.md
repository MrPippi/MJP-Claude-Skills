<div align="center">

# MJP-Paper-Skills

**Compile-verified Agent Skills for Minecraft Paper plugin development**

Low-level NMS with official Mojang names and pure Paper API, for any AI coding tool that reads `SKILL.md`

[![Paper](https://img.shields.io/badge/Paper-1.21.11%20%7C%2026.2-2ea44f)](https://papermc.io)
[![Java](https://img.shields.io/badge/Java-21%20%7C%2025-orange)](https://adoptium.net)
[![Skills](https://img.shields.io/badge/skills-30-blue)](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)
[![Agent Skills](https://img.shields.io/badge/format-Agent%20Skills-8a63d2)](https://agentskills.io)
[![Skills compile](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml/badge.svg)](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml)
[![License: MIT](https://img.shields.io/github/license/MrPippi/MJP-Paper-Skills)](LICENSE)

[**Documentation**](https://mrpippi.github.io/MJP-Paper-Skills) · [**Skill catalog**](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills) · [**Changelog**](CHANGELOG.md)

English · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)

</div>

---

AI coding tools often get Paper plugins subtly wrong: outdated or obfuscated NMS names, Bukkit calls from Netty or async threads, APIs that changed between versions. MJP-Paper-Skills gives your agent a vetted playbook instead. Each skill is a `SKILL.md` with a code template, build setup, threading rules and fallbacks that the agent reads before it writes code.

## Highlights

- **Compile-verified**: CI compiles every complete template against both Paper **1.21.11** and **26.2** on each change; version-specific lines are marked inline.
- **Official Mojang names**: NMS code uses Paperweight userdev and the names Minecraft ships unobfuscated since 26.1.
- **Thread-safe by design**: each skill states which thread every call runs on (main, Netty IO or async).
- **Tool-agnostic**: the open [Agent Skills](https://agentskills.io) format works with Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI and more.
- **Two tracks**: 16 NMS skills for low-level work and 14 Paper API skills that need only `paper-api`.
- **Readable docs**: every skill is also published on the [documentation site](https://mrpippi.github.io/MJP-Paper-Skills), in English and Traditional Chinese.

## Contents

- [Quick Start](#quick-start)
- [Skill Catalog](#skill-catalog)
- [How It Works](#how-it-works)
- [Compatibility](#compatibility)
- [Repository Structure](#repository-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

### 1. Install the skills

The [skills CLI](https://github.com/vercel-labs/skills) installs straight from this repository. You only need [Node.js](https://nodejs.org) for `npx`; there is no account or registration.

1. In your plugin project's root folder, run:

   ```bash
   npx skills add MrPippi/MJP-Paper-Skills
   ```

2. Choose the skills you want. The CLI detects your AI tools (Claude Code, Codex, Cursor, …) and asks which ones to install for, and whether to symlink (recommended) or copy.
3. Confirm the result with `npx skills list`.

Each skill bundles the build setup and threading rules it needs in its own `references/` folder, so installing a single skill works on its own.

| Goal | Command |
|------|---------|
| List the available skills | `npx skills add MrPippi/MJP-Paper-Skills --list` |
| Install one skill | `npx skills add MrPippi/MJP-Paper-Skills --skill paper-dialog-ui` |
| Install everything for specific tools, no prompts | `npx skills add MrPippi/MJP-Paper-Skills --skill '*' -a claude-code codex -y` |
| Install for all your projects (e.g. `~/.claude/skills/`) | add `-g` to any `add` command |
| Update installed skills | `npx skills update` |
| Remove a skill | `npx skills remove paper-dialog-ui` |

<details>
<summary>Manual install</summary>

Copy `MJP-Paper-Skills/.claude/skills/` into the folder your AI tool loads skills from:

| Tool | Common project path |
|------|---------------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex, Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # adjust the target for your tool
```

</details>

> [!NOTE]
> Skill paths vary between tools and versions; check your tool's documentation. Many tools also read `.agents/skills/` as a shared location.

**Tool without Agent Skills support?** Point its instructions file (`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, …) at the skills:

```markdown
Before writing Paper plugin code, find the matching skill in <skills-folder>/skills-registry.yml
(by trigger_keywords) and follow its SKILL.md, plus the files in its references/ folder.
```

### 2. Ask for what you need

Describe the feature in plain language. The tool matches your request against each skill's description and trigger keywords:

```text
"Send an action bar message to a player with a packet"
"Intercept ServerboundChatPacket and filter certain words"
"Create a custom Zombie entity with its own chase AI"
"Show a world border only this player can see"
```

---

## Skill Catalog

30 skills, all compile-verified against Paper 1.21.11 and 26.2. Browse them with filters and full templates on the [documentation site](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills); the machine-readable index is [`Skills/skills-registry.yml`](Skills/skills-registry.yml).

### NMS (16 skills, requires Paperweight userdev)

| Category | Skill | What it does |
|----------|-------|--------------|
| Packets | [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | Send custom clientbound packets to one player, a group or everyone |
| Packets | [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | Intercept and modify packets in the Netty pipeline |
| Entities | [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | Custom NMS entities with PathfinderGoal AI |
| Entities | [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | Dynamic attributes with AttributeMap and AttributeModifier |
| Players | [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | GameProfile skin injection for NPC appearance |
| Players | [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | Client-less ServerPlayer fake players (bots) |
| Data | [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | Read and write CompoundTag NBT on items, entities and block entities |
| Data | [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | DataComponentType item components |
| World | [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | Custom block entities with NBT, ticking and client sync |
| World | [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | Direct LevelChunk and ChunkSection block access |
| World | [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | Particle effects via ClientboundLevelParticlesPacket |
| Display | [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | Scoreboards, objectives and teams |
| Display | [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | Per-player boss bars with ServerBossEvent |
| UI | [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | Container GUIs built on AbstractContainerMenu |
| Bridge | [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | Reflection-based NMS access without Paperweight |
| Bridge | [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | Adapter pattern for multi-version NMS support |

### Paper API (14 skills, requires only `paper-api`)

| Category | Skill | What it does |
|----------|-------|--------------|
| UI | [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | Dialog API screens with callbacks on the main thread |
| UI | [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | InventoryHolder chest GUIs with paging and click protection |
| Data | [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | SQLite repository with `user_version` migrations and a single writer thread |
| Data | [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | Immutable config objects, config versioning and MiniMessage language files |
| Integration | [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | Cross-plugin APIs through ServicesManager |
| Integration | [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | Soft-dependency hooks for Vault and PlaceholderAPI |
| Integration | [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | Embedded JSON HTTP API bound to localhost, with rate limiting |
| Network | [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | Packet filtering with PacketEvents or ProtocolLib |
| Network | [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | Per-player world borders, time, weather and hidden players |
| Gameplay | [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | PvP combat tagging with damage attribution and combat-logout handling |
| Gameplay | [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | Safe-location search, random teleport, async teleport and cooldowns |
| Gameplay | [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | Multi-currency ledger, escrow and a Vault economy provider |
| Commands | [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | Brigadier commands registered via `LifecycleEvents.COMMANDS` |
| World | [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | Disposable worlds and arena resets |

---

## How It Works

```text
Your request ──▶ skill description ──▶ SKILL.md ──▶ references/ ──▶ Generated code
                 (trigger keywords)     (template,     (build.gradle,
                                        inputs,        paper-plugin.yml,
                                        fallbacks)     threading, naming)
```

1. The agent matches your request to a skill through its description and trigger keywords.
2. It reads the skill's `SKILL.md` (template, inputs, outputs, thread-safety notes, fallback) and `examples.md`.
3. It applies the platform build setup bundled in `references/`, generated from [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) or [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md).
4. It follows the threading and Mojang naming rules bundled in `references/`, generated from [`Skills/_shared/`](Skills/_shared).

For APIs beyond the templates, the [NMS quick reference](docs/paper-nms) covers packets, entities, the Netty pipeline and Bukkit ↔ NMS bridging.

---

## Compatibility

| Item | Supported |
|------|-----------|
| Minecraft / Paper | 1.21.11 and 26.2 (templates default to 26.2; 1.21.11 differences are marked `// @1.21.11:`) |
| Paper dev bundle | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| Java | 21 (1.21.11) / 25 (26.2) |
| Build | Gradle 8.11.2+ (verified with 9.8.1), Groovy DSL |
| Paperweight userdev | `2.0.0-beta.24` (NMS skills only; no `reobfJar` needed) |
| Shadow (optional) | `com.gradleup.shadow` `9.6.1`, for multi-module builds (`nms-version-adapter`) |
| Soft dependencies | VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0 |

The canonical `build.gradle` and `paper-plugin.yml` templates live in the two `PLATFORM.md` files. Upgrading from the 1.21.x templates? See [CHANGELOG.md](CHANGELOG.md) and section 5 of [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md).

---

## Repository Structure

```text
MJP-Paper-Skills/
├── .claude/skills/           # Ready-to-copy skill folder (mirrors Skills/, except the PLATFORM folders)
├── Skills/                   # Canonical skill sources
│   ├── skills-registry.yml   # Index of all 30 skills (paper-nms + paper-api)
│   ├── _shared/              # Threading and naming rules shared by all skills
│   ├── paper-nms/PLATFORM.md # NMS build.gradle / paper-plugin.yml templates, version table
│   ├── paper-api/PLATFORM.md # Paper API build setup, soft-dependency coordinates
│   ├── nms/<skill-id>/       # SKILL.md + examples.md + references/ (16 NMS skills)
│   └── paper/<skill-id>/     # SKILL.md + examples.md + references/ (14 Paper API skills)
├── scripts/                  # sync-skill-references.mjs (references/), extract-skill-java.mjs (compile check)
├── verify/                   # Gradle project that compiles the extracted templates for each version
├── docs/paper-nms/           # NMS API quick reference
├── web/                      # Next.js documentation site (static export to GitHub Pages)
├── CHANGELOG.md
└── CLAUDE.md                 # Maintainer instructions for AI agents working in this repo
```

---

## Contributing

Contributions are welcome. To add a skill:

1. Create `Skills/nms/<slug>/` or `Skills/paper/<slug>/` with `SKILL.md` and `examples.md` (at least two examples).
2. Mirror it to the same path under `.claude/skills/`, then run `node scripts/sync-skill-references.mjs` to generate its `references/` folder (re-run it whenever a `PLATFORM.md` or `_shared/` file changes).
3. Add the entry to both `skills-registry.yml` files.
4. Add the site page `web/data/skills/<slug>.md` and its English body `web/data/skills/en/<slug>.md`, then update the expected list in `web/tests/skills-api.data.test.ts`.
5. Make sure the templates compile against Paper 1.21.11 and 26.2. CI runs this on every pull request that touches `Skills/`; to run it locally (JDK 25 for 26.2, JDK 21 for 1.21.11):

   ```bash
   node scripts/extract-skill-java.mjs 26.2
   cd verify && ./gradlew compileSkills -Pmc=26.2
   ```

[`CLAUDE.md`](CLAUDE.md) documents the full process and repository invariants. To work on the documentation site:

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI runs the same checks on every pull request. See [`web/README.md`](web/README.md) for the site's stack and scripts.

---

## License

[MIT](LICENSE) © MrPippi

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
