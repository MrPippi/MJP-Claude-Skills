# MJP-Paper-Skills — Minecraft Paper Agent Skills

**Compile-verified [Agent Skills](https://agentskills.io) for Minecraft Paper 1.21.11 / 26.x plugin development — low-level NMS (net.minecraft.server) with official Mojang names, and pure Paper API.**

Each skill is a `SKILL.md` your AI coding tool reads before generating plugin code. The skills use the open Agent Skills format, so they work with Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI and any other tool that loads `SKILL.md`. Tools without skills support can still reference the files, and every skill reads fine as plain reference docs.

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> Docs site: **[mrpippi.github.io/MJP-Paper-Skills](https://mrpippi.github.io/MJP-Paper-Skills)** · Release notes: [CHANGELOG.md](CHANGELOG.md)

---

## Platform

| Item | Details |
|------|---------|
| **MC version** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **NMS naming** | Official Mojang names (Minecraft is unobfuscated since 26.1) |
| **Build tool** | Gradle 8.11.2+ (verified 9.8.1) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **Skill format** | [Agent Skills](https://agentskills.io) (`SKILL.md` + YAML frontmatter) |

> Upgrading from the 1.21.x templates? See [CHANGELOG.md](CHANGELOG.md) and the migration notes in [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (section 5).

---

## Skills

30 skills in two tracks, all compile-verified against Paper 1.21.11 and 26.2:

- **NMS** (16 skills, `Skills/nms/`): packets, Netty interception, custom entities, NBT / data components, GUIs, scoreboards, boss bars, particles, chunks, fake players, reflection and multi-version adapters. Needs Paperweight userdev.
- **Paper API** (14 skills, `Skills/paper/`): Dialogs, chest GUIs, SQLite, config & language files, cross-plugin APIs, soft dependencies, packet filters, PvP and economy gameplay, Brigadier commands, disposable worlds. Needs only `paper-api`.

👉 **Browse the full catalog, filterable by platform and category: [mrpippi.github.io/MJP-Paper-Skills/docs/skills](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)**

The machine-readable index (IDs, trigger keywords, inputs and outputs) is [`Skills/skills-registry.yml`](Skills/skills-registry.yml).

---

## Quick Start

### 1. Install the skills

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
```

Copy `MJP-Paper-Skills/.claude/skills/` into the folder your AI tool loads skills from:

| Tool | Common project path |
|------|---------------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex, Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # adjust the target for your tool
```

> Skill paths vary between tools and versions; check your tool's documentation. `.agents/skills/` is read by many tools as a shared location.

**Tool without Agent Skills support?** Point its instructions file (`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, …) at the skills:

```markdown
Before writing Paper plugin code, find the matching skill in <skills-folder>/skills-registry.yml
(by trigger_keywords) and follow its SKILL.md, plus the PLATFORM.md and _shared/ notes it references.
```

### 2. Use a skill

Describe what you need in plain language; the tool matches your request against each skill's description and trigger keywords:

```
"Send an action bar message to a player with a packet"
"Intercept ServerboundChatPacket and filter certain words"
"Create a custom Zombie entity with its own chase AI"
```

The agent reads the matching `SKILL.md`, the platform setup ([`PLATFORM.md`](Skills/paper-nms/PLATFORM.md)) and the shared threading / naming notes before generating code.

---

## Dependencies

### Plugins generated from the skills

| Dependency | Version | Notes |
|------------|---------|-------|
| Paper server | 1.21.11 / 26.2 | Templates are compile-verified against build 132 |
| Paper dev bundle (`paperweight.paperDevBundle`) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | 26.x format: `<mc>.build.<n>-<channel>` ([list](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)) |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | Pre-release; no `reobfJar` needed |
| Gradle | 8.11.2+ | Verified with 9.8.1 |
| JDK | 25 | Toolchain and `options.release` |
| `com.gradleup.shadow` (optional) | `9.6.1` | Only for multi-module / bundled builds (see `nms-version-adapter`) |
| `paper-api` (reflection-only / core modules) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

The canonical `build.gradle` and `paper-plugin.yml` live in [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (NMS skills) and [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md) (Paper API skills, with soft-dependency coordinates: VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0).

### Documentation website (`web/`)

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — full list and scripts in [`web/README.md`](web/README.md).

---

## Repository Structure

```
MJP-Paper-Skills/
├── .claude/skills/           ← Ready-to-copy skill folder (mirrors Skills/, except the PLATFORM folders)
├── Skills/                   ← Canonical skill sources
│   ├── skills-registry.yml   ← 30 skills (paper-nms + paper-api)
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md, paper-threading.md
│   ├── paper-nms/PLATFORM.md ← NMS build.gradle / paper-plugin.yml templates, version table
│   ├── paper-api/PLATFORM.md ← Paper API build.gradle, soft-dependency coordinates
│   ├── nms/<skill-id>/       ← SKILL.md + examples.md (16 NMS skills)
│   └── paper/<skill-id>/     ← SKILL.md + examples.md (14 Paper API skills)
├── docs/paper-nms/           ← NMS API quick reference (packets, entities, network, bridge)
├── web/                      ← Next.js documentation site (static export → GitHub Pages)
├── .github/workflows/        ← ci.yml (PR checks), nextjs.yml (deploy), Claude workflows
├── CHANGELOG.md
└── CLAUDE.md                 ← Maintainer instructions for AI agents working in this repo
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

1. Create `Skills/nms/<slug>/` or `Skills/paper/<slug>/` with `SKILL.md` + `examples.md` (≥ 2 examples)
2. Mirror to the same path under `.claude/skills/`
3. Add the entry to both `skills-registry.yml` files
4. Add `web/data/skills/<slug>.md` and update the expected list in `web/tests/skills-api.data.test.ts`
5. Compile the template classes against Paper 1.21.11 and 26.2 before merging

See `CLAUDE.md` for the complete 9-step process and invariants.

---

## License

MIT
