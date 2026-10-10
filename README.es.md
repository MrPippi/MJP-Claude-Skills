<div align="center">

# MJP-Paper-Skills

**Agent Skills verificados por compilación para el desarrollo de plugins de Minecraft Paper**

NMS de bajo nivel con los nombres oficiales de Mojang y Paper API puro, para cualquier herramienta de programación con IA que lea `SKILL.md`

[![Paper](https://img.shields.io/badge/Paper-1.21.11%20%7C%2026.2-2ea44f)](https://papermc.io)
[![Java](https://img.shields.io/badge/Java-21%20%7C%2025-orange)](https://adoptium.net)
[![Skills](https://img.shields.io/badge/skills-31-blue)](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)
[![Agent Skills](https://img.shields.io/badge/format-Agent%20Skills-8a63d2)](https://agentskills.io)
[![Skills compile](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml/badge.svg)](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml)
[![License: MIT](https://img.shields.io/github/license/MrPippi/MJP-Paper-Skills)](LICENSE)

[**Documentación**](https://mrpippi.github.io/MJP-Paper-Skills) · [**Catálogo de skills**](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills) · [**Registro de cambios**](CHANGELOG.md)

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · Español · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)

</div>

---

Las herramientas de programación con IA suelen cometer errores sutiles en los plugins de Paper: nombres de NMS obsoletos u ofuscados, llamadas a Bukkit desde Netty o desde hilos asíncronos, APIs que cambiaron entre versiones. MJP-Paper-Skills le da a tu agente una guía contrastada en su lugar. Cada skill es un `SKILL.md` con una plantilla de código, la configuración de compilación, las reglas de hilos y las alternativas de respaldo que el agente lee antes de escribir código.

## Aspectos destacados

- **Verificado por compilación**: la CI compila cada plantilla completa contra Paper **1.21.11** y **26.2** en cada cambio; las líneas específicas de una versión están marcadas en el propio código.
- **Nombres oficiales de Mojang**: el código NMS usa Paperweight userdev y los nombres que Minecraft distribuye sin ofuscar desde la 26.1.
- **Seguro entre hilos por diseño**: cada skill indica en qué hilo se ejecuta cada llamada (principal, Netty IO o asíncrono).
- **Independiente de la herramienta**: el formato abierto [Agent Skills](https://agentskills.io) funciona con Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI y más.
- **Dos vertientes**: 16 skills de NMS para trabajo de bajo nivel y 15 skills de Paper API que solo necesitan `paper-api`.
- **Documentación legible**: cada skill también se publica en el [sitio de documentación](https://mrpippi.github.io/MJP-Paper-Skills), en inglés y chino tradicional.

## Contenido

- [Inicio rápido](#inicio-rápido)
- [Catálogo de skills](#catálogo-de-skills)
- [Cómo funciona](#cómo-funciona)
- [Compatibilidad](#compatibilidad)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

---

## Inicio rápido

### 1. Instalar los skills

La [CLI de skills](https://github.com/vercel-labs/skills) instala directamente desde este repositorio. Solo necesitas [Node.js](https://nodejs.org) para `npx`; no hace falta cuenta ni registro.

1. En la carpeta raíz de tu proyecto de plugin, ejecuta:

   ```bash
   npx skills add MrPippi/MJP-Paper-Skills
   ```

2. Elige los skills que quieras. La CLI detecta tus herramientas de IA (Claude Code, Codex, Cursor, …) y te pregunta para cuáles instalar, y si usar enlaces simbólicos (recomendado) o copiar.
3. Confirma el resultado con `npx skills list`.

Cada skill incluye la configuración de compilación y las reglas de hilos que necesita en su propia carpeta `references/`, así que instalar un único skill por sí solo funciona.

| Objetivo | Comando |
|------|---------|
| Listar los skills disponibles | `npx skills add MrPippi/MJP-Paper-Skills --list` |
| Instalar un skill | `npx skills add MrPippi/MJP-Paper-Skills --skill paper-dialog-ui` |
| Instalar todo para herramientas concretas, sin preguntas | `npx skills add MrPippi/MJP-Paper-Skills --skill '*' -a claude-code codex -y` |
| Instalar para todos tus proyectos (p. ej. `~/.claude/skills/`) | añade `-g` a cualquier comando `add` |
| Actualizar los skills instalados | `npx skills update` |
| Eliminar un skill | `npx skills remove paper-dialog-ui` |

<details>
<summary>Instalación manual</summary>

Copia `MJP-Paper-Skills/.claude/skills/` en la carpeta desde la que tu herramienta de IA carga los skills:

| Herramienta | Ruta de proyecto habitual |
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
> Las rutas de los skills varían entre herramientas y versiones; consulta la documentación de tu herramienta. Muchas también leen `.agents/skills/` como ubicación compartida.

**¿Tu herramienta no admite Agent Skills?** Apunta su archivo de instrucciones (`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, …) hacia los skills:

```markdown
Before writing Paper plugin code, find the matching skill in <skills-folder>/skills-registry.yml
(by trigger_keywords) and follow its SKILL.md, plus the files in its references/ folder.
```

### 2. Pide lo que necesitas

Describe la funcionalidad con lenguaje natural. La herramienta compara tu petición con la descripción y las palabras clave de activación de cada skill:

```text
"Envía un mensaje en la action bar a un jugador mediante un paquete"
"Intercepta ServerboundChatPacket y filtra ciertas palabras"
"Crea una entidad Zombie personalizada con su propia IA de persecución"
"Muestra un borde del mundo que solo vea este jugador"
```

---

## Catálogo de skills

31 skills, todos verificados por compilación con Paper 1.21.11 y 26.2. Explóralos con filtros y plantillas completas en el [sitio de documentación](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills); el índice legible por máquina es [`Skills/skills-registry.yml`](Skills/skills-registry.yml).

### NMS (16 skills, requiere Paperweight userdev)

| Categoría | Skill | Qué hace |
|----------|-------|--------------|
| Paquetes | [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | Envía paquetes clientbound personalizados a un jugador, a un grupo o a todos |
| Paquetes | [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | Intercepta y modifica paquetes en el pipeline de Netty |
| Entidades | [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | Entidades NMS personalizadas con IA basada en PathfinderGoal |
| Entidades | [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | Atributos dinámicos con AttributeMap y AttributeModifier |
| Jugadores | [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | Inyección de skins mediante GameProfile para la apariencia de NPC |
| Jugadores | [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | Jugadores falsos (bots) con ServerPlayer sin cliente |
| Datos | [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | Lectura y escritura de NBT con CompoundTag en ítems, entidades y entidades de bloque |
| Datos | [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | Componentes de ítem con DataComponentType |
| Mundo | [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | Entidades de bloque personalizadas con NBT, ticks y sincronización con el cliente |
| Mundo | [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | Acceso directo a bloques mediante LevelChunk y ChunkSection |
| Mundo | [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | Efectos de partículas con ClientboundLevelParticlesPacket |
| Visualización | [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | Scoreboards, objetivos y equipos |
| Visualización | [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | Boss bars independientes por jugador con ServerBossEvent |
| Interfaz | [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | GUI de contenedor basadas en AbstractContainerMenu |
| Puente | [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | Acceso a NMS mediante reflexión, sin Paperweight |
| Puente | [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | Patrón Adapter para soporte NMS multiversión |

### Paper API (15 skills, requiere solo `paper-api`)

| Categoría | Skill | Qué hace |
|----------|-------|--------------|
| Interfaz | [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | Pantallas con la Dialog API y callbacks en el hilo principal |
| Interfaz | [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | GUI de cofre con InventoryHolder, paginación y protección contra clics |
| Datos | [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | Repositorio SQLite con migraciones por `user_version` y un único hilo de escritura |
| Datos | [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | Objetos de configuración inmutables, versionado de configuración y archivos de idioma con MiniMessage |
| Integración | [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | APIs entre plugins mediante ServicesManager |
| Integración | [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | Hooks de dependencias suaves para Vault y PlaceholderAPI |
| Integración | [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | API HTTP JSON embebida enlazada a localhost, con limitación de tasa |
| Integración | [`paper-discord-bridge`](Skills/paper/paper-discord-bridge/SKILL.md) | Puente de chat bidireccional con Discord usando solo el JDK: webhooks de salida, Gateway de entrada |
| Red | [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | Filtrado de paquetes con PacketEvents o ProtocolLib |
| Red | [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | Bordes del mundo, hora, clima y jugadores ocultos por jugador |
| Jugabilidad | [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | Marca de combate PvP con atribución de daño y gestión de desconexión en combate |
| Jugabilidad | [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | Búsqueda de ubicaciones seguras, teletransporte aleatorio, teletransporte asíncrono y tiempos de espera |
| Jugabilidad | [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | Libro contable multimoneda, depósito en garantía y un proveedor de economía para Vault |
| Comandos | [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | Comandos Brigadier registrados mediante `LifecycleEvents.COMMANDS` |
| Mundo | [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | Mundos desechables y reinicio de arenas |

---

## Cómo funciona

```text
Your request ──▶ skill description ──▶ SKILL.md ──▶ references/ ──▶ Generated code
                 (trigger keywords)     (template,     (build.gradle,
                                        inputs,        paper-plugin.yml,
                                        fallbacks)     threading, naming)
```

1. El agente asocia tu petición con un skill a través de su descripción y sus palabras clave de activación.
2. Lee el `SKILL.md` del skill (plantilla, entradas, salidas, notas de seguridad entre hilos, alternativa de respaldo) y `examples.md`.
3. Aplica la configuración de compilación de la plataforma incluida en `references/`, generada a partir de [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) o [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md).
4. Sigue las reglas de hilos y de nomenclatura de Mojang incluidas en `references/`, generadas a partir de [`Skills/_shared/`](Skills/_shared).

Para las APIs que las plantillas no cubren, la [referencia rápida de NMS](docs/paper-nms) abarca paquetes, entidades, el pipeline de Netty y el puente Bukkit ↔ NMS.

---

## Compatibilidad

| Elemento | Compatible |
|------|-----------|
| Minecraft / Paper | 1.21.11 y 26.2 (las plantillas usan 26.2 por defecto; las diferencias de 1.21.11 se marcan con `// @1.21.11:`) |
| Paper dev bundle | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| Java | 21 (1.21.11) / 25 (26.2) |
| Compilación | Gradle 8.11.2+ (verificado con 9.8.1), Groovy DSL |
| Paperweight userdev | `2.0.0-beta.24` (solo skills de NMS; no se necesita `reobfJar`) |
| Shadow (opcional) | `com.gradleup.shadow` `9.6.1`, para compilaciones multimódulo (`nms-version-adapter`) |
| Dependencias suaves | VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0 |

Las plantillas canónicas de `build.gradle` y `paper-plugin.yml` están en los dos archivos `PLATFORM.md`. ¿Actualizas desde las plantillas de 1.21.x? Consulta [CHANGELOG.md](CHANGELOG.md) y la sección 5 de [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md).

---

## Estructura del repositorio

```text
MJP-Paper-Skills/
├── .claude/skills/           # Carpeta de skills lista para copiar (refleja Skills/, salvo las carpetas PLATFORM)
├── Skills/                   # Fuentes canónicas de los skills
│   ├── skills-registry.yml   # Índice de los 31 skills (paper-nms + paper-api)
│   ├── _shared/              # Reglas de hilos y nomenclatura compartidas por todos los skills
│   ├── paper-nms/PLATFORM.md # Plantillas de build.gradle / paper-plugin.yml para NMS, tabla de versiones
│   ├── paper-api/PLATFORM.md # Configuración de compilación de Paper API, coordenadas de dependencias suaves
│   ├── nms/<skill-id>/       # SKILL.md + examples.md + references/ (16 skills de NMS)
│   └── paper/<skill-id>/     # SKILL.md + examples.md + references/ (15 skills de Paper API)
├── scripts/                  # sync-skill-references.mjs (references/), extract-skill-java.mjs (comprobación de compilación)
├── verify/                   # Proyecto Gradle que compila las plantillas extraídas para cada versión
├── docs/paper-nms/           # Referencia rápida de la API de NMS
├── web/                      # Sitio de documentación en Next.js (exportación estática a GitHub Pages)
├── CHANGELOG.md
└── CLAUDE.md                 # Instrucciones para mantenedores y agentes de IA que trabajan en este repositorio
```

---

## Contribuir

Las contribuciones son bienvenidas. Para añadir un skill:

1. Crea `Skills/nms/<slug>/` o `Skills/paper/<slug>/` con `SKILL.md` y `examples.md` (al menos dos ejemplos).
2. Replícalo en la misma ruta bajo `.claude/skills/` y luego ejecuta `node scripts/sync-skill-references.mjs` para generar su carpeta `references/` (vuelve a ejecutarlo cuando cambie un `PLATFORM.md` o un archivo de `_shared/`).
3. Añade la entrada en ambos archivos `skills-registry.yml`.
4. Añade la página del sitio `web/data/skills/<slug>.md` y su versión en inglés `web/data/skills/en/<slug>.md`, y luego actualiza la lista esperada en `web/tests/skills-api.data.test.ts`.
5. Asegúrate de que las plantillas compilan contra Paper 1.21.11 y 26.2. La CI lo ejecuta en cada pull request que toque `Skills/`; para ejecutarlo en local (JDK 25 para 26.2, JDK 21 para 1.21.11):

   ```bash
   node scripts/extract-skill-java.mjs 26.2
   cd verify && ./gradlew compileSkills -Pmc=26.2
   ```

[`CLAUDE.md`](CLAUDE.md) documenta el proceso completo y los invariantes del repositorio. Para trabajar en el sitio de documentación:

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # tests (node:test + tsx)
npm run build      # static export to web/out/
```

La CI ejecuta las mismas comprobaciones en cada pull request. Consulta [`web/README.md`](web/README.md) para conocer el stack y los scripts del sitio.

---

## Licencia

[MIT](LICENSE) © MrPippi

No es un producto oficial de Minecraft. No está aprobado por Mojang ni Microsoft ni asociado a ellas.
