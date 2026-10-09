# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**A curated library of [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) for low-level Minecraft NMS (net.minecraft.server) development on Paper 1.21.x with Mojang mappings.**

MJP-Claude-Skills provides production-ready NMS skill templates that Claude Code reads before generating plugin code — covering packet sending, Netty pipeline interception, custom entity AI, reflection-based cross-version access, and multi-version adapter patterns.

> 繁體中文說明請見 [README.zh-TW.md](README.zh-TW.md)

---

## Platform

| Item | Details |
|------|---------|
| **MC Versions** | 1.21 – 1.21.3 |
| **NMS Mapping** | Mojang mappings (Paper 1.20.5+ native) |
| **Build Tool** | Paperweight userdev `2.0.0-beta.24+` |
| **Java** | 21 (toolchain) |
| **Runtime** | `.claude/skills/` (Claude Code) |

---

## Skills

| Skill ID | Category | Purpose |
|----------|----------|---------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | Send Clientbound packets via `ServerPlayer.connection.send()` |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | Inject `ChannelDuplexHandler` into Netty pipeline to intercept/modify packets |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | Extend NMS mob classes with custom `PathfinderGoal` AI behavior |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | Access NMS via `MethodHandle` cache without Paperweight compile dependency |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | Multi-version compatibility via abstract adapter interface + runtime dispatch |

---

## Quick Start

### 1. Install the Skill Runtime

Clone or copy `.claude/skills/` into your project root:

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. Configure Claude Code

Ensure Claude Code picks up local skills (no extra config needed — `.claude/skills/` is auto-loaded).

### 3. Use a Skill

In a Claude Code session, describe what you want using trigger keywords:

```
# Examples:
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

Claude Code will read the matching `SKILL.md` and generate production-ready code.

---

## Repository Structure

```
MJP-Claude-Skills/
├── .claude/skills/          ← Claude Code runtime (mirrors Skills/)
│   ├── skills-registry.yml
│   ├── _shared/
│   └── nms/
├── Skills/                  ← Canonical skill sources
│   ├── skills-registry.yml  ← v5.0.0
│   ├── _shared/
│   │   ├── nms-threading.md
│   │   └── nms-obfuscation.md
│   ├── paper-nms/
│   │   └── PLATFORM.md      ← Paperweight build.gradle template
│   └── nms/
│       ├── nms-packet-sender/
│       ├── nms-packet-interceptor/
│       ├── nms-custom-entity/
│       ├── nms-reflection-bridge/
│       └── nms-version-adapter/
└── docs/paper-nms/          ← NMS API quick reference
    ├── packets.md
    ├── entities.md
    ├── network.md
    └── bukkit-nms-bridge.md
```

---

## Adding New Skills

1. Create `Skills/nms/<slug>/SKILL.md` + `examples.md` (≥2 examples required)
2. Mirror to `.claude/skills/nms/<slug>/`
3. Add entry to both `skills-registry.yml` files
4. Reference relevant `docs/paper-nms/` files in the SKILL.md Fallback section

See `CLAUDE.md` for the complete 7-step process and invariants.

---

## License

MIT
