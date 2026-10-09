# MJP-Paper-Skills — Agent Skills для Minecraft Paper

**Agent Skills ([Agent Skills](https://agentskills.io)) с проверенной компиляцией для разработки плагинов Minecraft Paper 1.21.11 / 26.x — низкоуровневый NMS (net.minecraft.server) с официальными названиями Mojang и чистый Paper API.**

Каждый навык — это файл `SKILL.md`, который ваш ИИ-инструмент для программирования читает перед генерацией кода плагина. Навыки используют открытый формат Agent Skills, поэтому работают с Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI и любым другим инструментом, загружающим `SKILL.md`. Инструменты без поддержки навыков всё равно могут ссылаться на эти файлы, а каждый навык вполне читается как обычная справочная документация.

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> Сайт документации: **[mrpippi.github.io/MJP-Paper-Skills](https://mrpippi.github.io/MJP-Paper-Skills)** · Примечания к выпуску: [CHANGELOG.md](CHANGELOG.md)

---

## Платформа

| Параметр | Подробности |
|------|---------|
| **Версия MC** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **Именование NMS** | Официальные названия Mojang (Minecraft не обфусцирован начиная с 26.1) |
| **Инструмент сборки** | Gradle 8.11.2+ (проверено на 9.8.1) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **Формат навыков** | [Agent Skills](https://agentskills.io) (`SKILL.md` + YAML frontmatter) |

> Обновляетесь с шаблонов 1.21.x? См. [CHANGELOG.md](CHANGELOG.md) и заметки по миграции в [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (раздел 5).

---

## Навыки

30 навыков в двух направлениях, все с проверенной компиляцией на Paper 1.21.11 и 26.2:

- **NMS** (16 навыков, `Skills/nms/`): пакеты, перехват через Netty, пользовательские сущности, NBT / data components, GUI, скорборды, боссбары, частицы, чанки, фейковые игроки, рефлексия и адаптеры для нескольких версий. Требует Paperweight userdev.
- **Paper API** (14 навыков, `Skills/paper/`): Dialogs, GUI-сундуки, SQLite, конфигурация и языковые файлы, API между плагинами, мягкие зависимости, фильтры пакетов, геймплей PvP и экономики, команды Brigadier, одноразовые миры. Требует только `paper-api`.

👉 **Полный каталог с фильтрацией по платформе и категории: [mrpippi.github.io/MJP-Paper-Skills/docs/skills](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)**

Машиночитаемый индекс (ID, ключевые слова-триггеры, входные и выходные данные) — [`Skills/skills-registry.yml`](Skills/skills-registry.yml).

---

## Быстрый старт

### 1. Установите навыки

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
```

Скопируйте `MJP-Paper-Skills/.claude/skills/` в папку, из которой ваш ИИ-инструмент загружает навыки:

| Инструмент | Типичный путь в проекте |
|------|---------------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex, Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # измените целевой путь под свой инструмент
```

> Пути к навыкам различаются между инструментами и версиями; смотрите документацию вашего инструмента. `.agents/skills/` многие инструменты читают как общее расположение.

**Инструмент без поддержки Agent Skills?** Укажите в его файле инструкций (`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, …) на навыки:

```markdown
Перед написанием кода плагина Paper найди подходящий навык в <skills-folder>/skills-registry.yml
(по trigger_keywords) и следуй его SKILL.md, а также заметкам PLATFORM.md и _shared/, на которые он ссылается.
```

### 2. Используйте навык

Опишите, что вам нужно, обычным языком; инструмент сопоставит ваш запрос с описанием и ключевыми словами-триггерами каждого навыка:

```
"Отправь игроку сообщение в action bar через пакет"
"Перехвати ServerboundChatPacket и отфильтруй определённые слова"
"Создай пользовательскую сущность Zombie с собственным ИИ преследования"
```

Агент читает соответствующий `SKILL.md`, настройку платформы ([`PLATFORM.md`](Skills/paper-nms/PLATFORM.md)) и общие заметки по потокам и именованию перед генерацией кода.

---

## Зависимости

### Плагины, генерируемые из навыков

| Зависимость | Версия | Примечания |
|------------|---------|-------|
| Сервер Paper | 1.21.11 / 26.2 | Компиляция шаблонов проверена на сборке 132 |
| Paper dev bundle (`paperweight.paperDevBundle`) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | Формат 26.x: `<mc>.build.<n>-<channel>` ([список](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)) |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | Предварительный выпуск; `reobfJar` не нужен |
| Gradle | 8.11.2+ | Проверено на 9.8.1 |
| JDK | 25 | Toolchain и `options.release` |
| `com.gradleup.shadow` (необязательно) | `9.6.1` | Только для многомодульных / собираемых в один JAR сборок (см. `nms-version-adapter`) |
| `paper-api` (модули только с рефлексией / core) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

Канонические `build.gradle` и `paper-plugin.yml` находятся в [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (навыки NMS) и [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md) (навыки Paper API, с координатами мягких зависимостей: VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0).

### Сайт документации (`web/`)

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — полный список и скрипты в [`web/README.md`](web/README.md).

---

## Структура репозитория

```
MJP-Paper-Skills/
├── .claude/skills/           ← Готовая к копированию папка навыков (зеркало Skills/, кроме папок PLATFORM)
├── Skills/                   ← Канонические исходники навыков
│   ├── skills-registry.yml   ← 30 навыков (paper-nms + paper-api)
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md, paper-threading.md
│   ├── paper-nms/PLATFORM.md ← Шаблоны NMS build.gradle / paper-plugin.yml, таблица версий
│   ├── paper-api/PLATFORM.md ← build.gradle для Paper API, координаты мягких зависимостей
│   ├── nms/<skill-id>/       ← SKILL.md + examples.md (16 навыков NMS)
│   └── paper/<skill-id>/     ← SKILL.md + examples.md (14 навыков Paper API)
├── docs/paper-nms/           ← Краткий справочник по NMS API (пакеты, сущности, сеть, мост)
├── web/                      ← Сайт документации на Next.js (статический экспорт → GitHub Pages)
├── .github/workflows/        ← ci.yml (проверки PR), nextjs.yml (деплой), рабочие процессы Claude
├── CHANGELOG.md
└── CLAUDE.md                 ← Инструкции для ИИ-агентов, работающих в этом репозитории
```

---

## Разработка

```bash
cd web
npm ci
npx tsc --noEmit   # проверка типов
npm test           # characterization-тесты (node:test + tsx)
npm run build      # статический экспорт в web/out/
```

CI выполняет те же проверки для каждого pull request (`.github/workflows/ci.yml`).

---

## Добавление новых навыков

1. Создайте `Skills/nms/<slug>/` или `Skills/paper/<slug>/` с `SKILL.md` + `examples.md` (≥ 2 примера)
2. Продублируйте по тому же пути в `.claude/skills/`
3. Добавьте запись в оба файла `skills-registry.yml`
4. Добавьте `web/data/skills/<slug>.md` и обновите ожидаемый список в `web/tests/skills-api.data.test.ts`
5. Перед слиянием скомпилируйте классы шаблона с Paper 1.21.11 и 26.2

Полный 9-шаговый процесс и инварианты см. в `CLAUDE.md`.

---

## Лицензия

MIT
