# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**Una biblioteca curada de [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) para el desarrollo de bajo nivel con NMS (net.minecraft.server) de Minecraft en Paper 1.21.11 / 26.x con los nombres oficiales de Mojang.**

MJP-Claude-Skills ofrece plantillas de skills NMS verificadas por compilación que Claude Code lee antes de generar código de plugins: paquetes, intercepción con Netty, entidades personalizadas, NBT / componentes de datos, GUI, scoreboards, boss bars, partículas, chunks, acceso basado en reflexión y adaptadores multiversión.

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> Notas de la versión: [CHANGELOG.md](CHANGELOG.md)

---

## Plataforma

| Elemento | Detalles |
|------|---------|
| **Versión de MC** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **Nomenclatura NMS** | Nombres oficiales de Mojang (Minecraft no está ofuscado desde 26.1) |
| **Herramienta de compilación** | Gradle 8.11.2+ (verificado con 9.8.1) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **Runtime de skills** | `.claude/skills/` (Claude Code) |

> ¿Actualizas desde las plantillas de 1.21.x? Consulta [CHANGELOG.md](CHANGELOG.md) y las notas de migración en [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (sección 5).

---

## Skills

| ID de skill | Categoría | Propósito |
|----------|----------|---------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | Enviar paquetes Clientbound mediante `ServerPlayer.connection.send()` |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | Inyectar un `ChannelDuplexHandler` en el pipeline de Netty para interceptar/modificar paquetes |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | Mobs NMS personalizados con IA basada en `Goal` |
| [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | nms-entity | Leer/modificar atributos de entidades con `AttributeModifier` |
| [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | nms-data | `custom_data` de ítems y NBT de entidades mediante `CompoundTag` / `ValueOutput` |
| [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | nms-data | Sistema `DataComponentType` de ítems (custom data, tamaño de pila, encantamientos…) |
| [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | nms-ui | GUI con `AbstractContainerMenu` y un puente con `InventoryHolder` de Bukkit |
| [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | nms-display | Barras laterales y equipos por jugador mediante paquetes de scoreboard |
| [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | nms-display | Boss bars por jugador con `ServerBossEvent` |
| [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | nms-player | Skins con `GameProfile` para NPC y cabezas de jugador |
| [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | nms-world | Partículas del lado del cliente con `ClientboundLevelParticlesPacket` |
| [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | nms-world | `BlockEntity` personalizado con persistencia, ticks y sincronización con el cliente |
| [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | nms-world | Acceso directo a `LevelChunk` / secciones y ediciones masivas de bloques |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | Acceso a NMS con caché de `MethodHandle` sin dependencia de compilación de Paperweight |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | Interfaz de adaptador multiversión con despacho en tiempo de ejecución |

---

## Inicio rápido

### 1. Instalar el runtime de skills

Copia `.claude/skills/` en la raíz de tu proyecto:

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. Usar un skill

Claude Code detecta `.claude/skills/` automáticamente. Describe lo que necesitas usando palabras clave de activación:

```
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

Claude Code lee el `SKILL.md` correspondiente, [`PLATFORM.md`](Skills/paper-nms/PLATFORM.md) y las notas compartidas de hilos y nomenclatura antes de generar código.

---

## Dependencias

### Plugins generados a partir de los skills

| Dependencia | Versión | Notas |
|------------|---------|-------|
| Servidor Paper | 1.21.11 / 26.2 | Las plantillas están verificadas por compilación con la build 132 |
| Paper dev bundle (`paperweight.paperDevBundle`) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | Formato 26.x: `<mc>.build.<n>-<channel>` ([lista](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)) |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | Versión preliminar; no se necesita `reobfJar` |
| Gradle | 8.11.2+ | Verificado con 9.8.1 |
| JDK | 25 | Toolchain y `options.release` |
| `com.gradleup.shadow` (opcional) | `9.6.1` | Solo para compilaciones multimódulo / empaquetadas (ver `nms-version-adapter`) |
| `paper-api` (solo reflexión / módulos core) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

El `build.gradle` y el `paper-plugin.yml` canónicos se encuentran en [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md).

### Sitio web de documentación (`web/`)

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — lista completa y scripts en [`web/README.md`](web/README.md).

---

## Estructura del repositorio

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

## Desarrollo

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # characterization tests (node:test + tsx)
npm run build      # static export to web/out/
```

La CI ejecuta las mismas comprobaciones en cada pull request (`.github/workflows/ci.yml`).

---

## Agregar nuevos skills

1. Crea `Skills/nms/<slug>/SKILL.md` + `examples.md` (≥ 2 ejemplos)
2. Replícalo en `.claude/skills/nms/<slug>/`
3. Agrega la entrada en ambos archivos `skills-registry.yml`
4. Agrega `web/data/skills/<slug>.md` y actualiza la lista esperada en `web/tests/skills-api.data.test.ts`
5. Compila las clases de la plantilla contra el dev bundle actual antes de fusionar

Consulta `CLAUDE.md` para el proceso completo de 8 pasos y las invariantes.

---

## Licencia

MIT
