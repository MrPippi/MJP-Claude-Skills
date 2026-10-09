# MJP-Paper-Skills — Minecraft Paper Agent Skills

**[Agent Skills](https://agentskills.io) verificados por compilación para el desarrollo de plugins de Minecraft Paper 1.21.11 / 26.x: NMS de bajo nivel (net.minecraft.server) con los nombres oficiales de Mojang y Paper API puro.**

Cada skill es un `SKILL.md` que tu herramienta de programación con IA lee antes de generar código de plugins. Los skills usan el formato abierto Agent Skills, por lo que funcionan con Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI y cualquier otra herramienta que cargue `SKILL.md`. Las herramientas sin soporte de skills pueden igualmente consultar los archivos, y cada skill se lee bien como documentación de referencia simple.

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> Sitio de documentación: **[mrpippi.github.io/MJP-Paper-Skills](https://mrpippi.github.io/MJP-Paper-Skills)** · Notas de la versión: [CHANGELOG.md](CHANGELOG.md)

---

## Plataforma

| Elemento | Detalles |
|------|---------|
| **Versión de MC** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **Nomenclatura NMS** | Nombres oficiales de Mojang (Minecraft no está ofuscado desde 26.1) |
| **Herramienta de compilación** | Gradle 8.11.2+ (verificado con 9.8.1) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **Formato de skills** | [Agent Skills](https://agentskills.io) (`SKILL.md` + frontmatter YAML) |

> ¿Actualizas desde las plantillas de 1.21.x? Consulta [CHANGELOG.md](CHANGELOG.md) y las notas de migración en [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (sección 5).

---

## Skills

30 skills en dos vertientes, todos verificados por compilación con Paper 1.21.11 y 26.2:

- **NMS** (16 skills, `Skills/nms/`): paquetes, intercepción con Netty, entidades personalizadas, NBT / componentes de datos, GUI, scoreboards, boss bars, partículas, chunks, jugadores falsos, reflexión y adaptadores multiversión. Requiere Paperweight userdev.
- **Paper API** (14 skills, `Skills/paper/`): Dialogs, GUI de cofre, SQLite, archivos de configuración e idioma, APIs entre plugins, dependencias suaves, filtros de paquetes, jugabilidad de PvP y economía, comandos Brigadier, mundos desechables. Solo necesita `paper-api`.

👉 **Explora el catálogo completo, filtrable por plataforma y categoría: [mrpippi.github.io/MJP-Paper-Skills/docs/skills](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)**

El índice legible por máquina (IDs, palabras clave de activación, entradas y salidas) es [`Skills/skills-registry.yml`](Skills/skills-registry.yml).

---

## Inicio rápido

### 1. Instalar los skills

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
```

Copia `MJP-Paper-Skills/.claude/skills/` en la carpeta desde la que tu herramienta de IA carga los skills:

| Herramienta | Ruta de proyecto habitual |
|------|---------------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex, Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # ajusta el destino según tu herramienta
```

> Las rutas de los skills varían entre herramientas y versiones; consulta la documentación de tu herramienta. Muchas herramientas leen `.agents/skills/` como ubicación compartida.

**¿Una herramienta sin soporte de Agent Skills?** Apunta su archivo de instrucciones (`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, …) hacia los skills:

```markdown
Antes de escribir código de plugins de Paper, busca el skill correspondiente en <skills-folder>/skills-registry.yml
(por trigger_keywords) y sigue su SKILL.md, además de las notas de PLATFORM.md y _shared/ que referencia.
```

### 2. Usar un skill

Describe lo que necesitas en lenguaje natural; la herramienta compara tu petición con la descripción y las palabras clave de activación de cada skill:

```
"Envía un mensaje de action bar a un jugador mediante un paquete"
"Intercepta ServerboundChatPacket y filtra ciertas palabras"
"Crea una entidad Zombie personalizada con su propia IA de persecución"
```

El agente lee el `SKILL.md` correspondiente, la configuración de la plataforma ([`PLATFORM.md`](Skills/paper-nms/PLATFORM.md)) y las notas compartidas de hilos y nomenclatura antes de generar código.

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
MJP-Paper-Skills/
├── .claude/skills/           ← Carpeta de skills lista para copiar (refleja Skills/, salvo las carpetas PLATFORM)
├── Skills/                   ← Fuentes canónicas de los skills
│   ├── skills-registry.yml   ← 30 skills (paper-nms + paper-api)
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md, paper-threading.md
│   ├── paper-nms/PLATFORM.md ← Plantillas de build.gradle / paper-plugin.yml para NMS, tabla de versiones
│   ├── paper-api/PLATFORM.md ← build.gradle de Paper API, coordenadas de dependencias suaves
│   ├── nms/<skill-id>/       ← SKILL.md + examples.md (16 skills NMS)
│   └── paper/<skill-id>/     ← SKILL.md + examples.md (14 skills de Paper API)
├── docs/paper-nms/           ← Referencia rápida de la API NMS (paquetes, entidades, red, puente)
├── web/                      ← Sitio de documentación Next.js (exportación estática → GitHub Pages)
├── .github/workflows/        ← ci.yml (comprobaciones de PR), nextjs.yml (despliegue), workflows de Claude
├── CHANGELOG.md
└── CLAUDE.md                 ← Instrucciones para mantenedores y agentes de IA que trabajan en este repo
```

---

## Desarrollo

```bash
cd web
npm ci
npx tsc --noEmit   # comprobación de tipos
npm test           # tests de caracterización (node:test + tsx)
npm run build      # exportación estática a web/out/
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
