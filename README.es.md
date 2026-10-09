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

30 skills en dos vertientes: los skills **NMS** requieren Paperweight userdev; los skills de **Paper API** solo necesitan `paper-api`. Cada plantilla está verificada por compilación con Paper 1.21.11 y 26.2.

### Skills NMS (`Skills/nms/`)

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
| [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | nms-player | Jugadores falsos (bots) sin cliente, respaldados por un `ServerPlayer` real de NMS |

### Skills de Paper API (sin NMS, `Skills/paper/`)

| ID de skill | Categoría | Propósito |
|----------|----------|---------|
| [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | paper-ui | Pantallas de la Dialog API de Paper con callbacks seguros para el hilo principal |
| [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | paper-ui | GUI de cofre con `InventoryHolder`, paginación y protección contra clics |
| [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | paper-data | Repositorios SQLite, migraciones con `user_version`, flusher de escritor único |
| [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | paper-data | Instantáneas de configuración inmutables, `config-version`, archivos de idioma con MiniMessage |
| [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | paper-integration | APIs entre plugins mediante `ServicesManager`, tolerantes a discrepancias de versión entre jars |
| [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | paper-integration | Hook/Bridge de dependencia suave, Vault, expansiones de PlaceholderAPI |
| [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | paper-integration | API JSON con `HttpServer` del JDK embebido (localhost, límite de peticiones, instantáneas) |
| [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | paper-network | Filtros de paquetes con PacketEvents / ProtocolLib (seguros para el hilo de Netty, fail-open) |
| [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | paper-network | Ilusiones por jugador de borde del mundo, hora, clima y visibilidad |
| [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | paper-gameplay | Etiquetado de combate PvP con atribución de daño y manejo de desconexión |
| [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | paper-gameplay | Búsqueda de puntos seguros, RTP, teletransportes asíncronos, esperas y enfriamientos |
| [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | paper-gameplay | Libro mayor multimoneda, depósito en garantía y un proveedor de Vault |
| [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | paper-command | Comandos Brigadier mediante `LifecycleEvents.COMMANDS` |
| [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | paper-world | Mundos desechables y arenas reiniciables |

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

El `build.gradle` y el `paper-plugin.yml` canónicos se encuentran en [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (skills NMS) y [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md) (skills de Paper API, con las coordenadas de las dependencias suaves: VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0).

### Sitio web de documentación (`web/`)

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — lista completa y scripts en [`web/README.md`](web/README.md).

---

## Estructura del repositorio

```
MJP-Claude-Skills/
├── .claude/skills/           ← Claude Code runtime (mirrors Skills/, except the PLATFORM folders)
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

1. Crea `Skills/nms/<slug>/` o `Skills/paper/<slug>/` con `SKILL.md` + `examples.md` (≥ 2 ejemplos)
2. Replícalo en la misma ruta dentro de `.claude/skills/`
3. Agrega la entrada en ambos archivos `skills-registry.yml`
4. Agrega `web/data/skills/<slug>.md` y actualiza la lista esperada en `web/tests/skills-api.data.test.ts`
5. Compila las clases de la plantilla contra Paper 1.21.11 y 26.2 antes de fusionar

Consulta `CLAUDE.md` para el proceso completo de 9 pasos y las invariantes.

---

## Licencia

MIT
