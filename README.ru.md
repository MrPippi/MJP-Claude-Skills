<div align="center">

# MJP-Paper-Skills

**Agent Skills с проверенной компиляцией для разработки плагинов Minecraft Paper**

Низкоуровневый NMS с официальными названиями Mojang и чистый Paper API — для любого ИИ-инструмента для программирования, который читает `SKILL.md`

[![Paper](https://img.shields.io/badge/Paper-1.21.11%20%7C%2026.2-2ea44f)](https://papermc.io)
[![Java](https://img.shields.io/badge/Java-21%20%7C%2025-orange)](https://adoptium.net)
[![Skills](https://img.shields.io/badge/skills-30-blue)](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)
[![Agent Skills](https://img.shields.io/badge/format-Agent%20Skills-8a63d2)](https://agentskills.io)
[![Skills compile](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml/badge.svg)](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml)
[![License: MIT](https://img.shields.io/github/license/MrPippi/MJP-Paper-Skills)](LICENSE)

[**Документация**](https://mrpippi.github.io/MJP-Paper-Skills) · [**Каталог навыков**](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills) · [**Журнал изменений**](CHANGELOG.md)

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · Русский

</div>

---

ИИ-инструменты для программирования часто допускают тонкие ошибки в плагинах Paper: устаревшие или обфусцированные названия NMS, вызовы Bukkit из Netty или асинхронных потоков, API, изменившиеся между версиями. MJP-Paper-Skills даёт вашему агенту проверенное руководство. Каждый навык — это файл `SKILL.md` с шаблоном кода, настройкой сборки, правилами работы с потоками и запасными вариантами, который агент читает перед написанием кода.

## Основные возможности

- **Проверенная компиляция**: CI при каждом изменении компилирует каждый полный шаблон под Paper **1.21.11** и **26.2**; строки, зависящие от версии, помечены прямо в коде.
- **Официальные названия Mojang**: код NMS использует Paperweight userdev и названия, с которыми Minecraft поставляется без обфускации начиная с 26.1.
- **Потокобезопасность по умолчанию**: каждый навык указывает, в каком потоке выполняется каждый вызов (основной, Netty IO или асинхронный).
- **Не привязано к инструменту**: открытый формат [Agent Skills](https://agentskills.io) работает с Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI и другими.
- **Два направления**: 16 навыков NMS для низкоуровневой работы и 14 навыков Paper API, которым нужен только `paper-api`.
- **Удобная документация**: каждый навык также опубликован на [сайте документации](https://mrpippi.github.io/MJP-Paper-Skills) на английском и традиционном китайском.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Каталог навыков](#каталог-навыков)
- [Как это работает](#как-это-работает)
- [Совместимость](#совместимость)
- [Структура репозитория](#структура-репозитория)
- [Участие в разработке](#участие-в-разработке)
- [Лицензия](#лицензия)

---

## Быстрый старт

### 1. Установите навыки

[CLI skills](https://github.com/vercel-labs/skills) устанавливает навыки прямо из этого репозитория. Вам нужен только [Node.js](https://nodejs.org) для `npx`; аккаунт и регистрация не требуются.

1. В корневой папке вашего проекта плагина выполните:

   ```bash
   npx skills add MrPippi/MJP-Paper-Skills
   ```

2. Выберите нужные навыки. CLI определяет ваши ИИ-инструменты (Claude Code, Codex, Cursor, …) и спрашивает, для каких из них установить, а также использовать ли символические ссылки (рекомендуется) или копирование.
3. Проверьте результат командой `npx skills list`.

Каждый навык включает нужные ему настройки сборки и правила работы с потоками в собственной папке `references/`, поэтому установка одного навыка отдельно работает.

| Цель | Команда |
|------|---------|
| Показать доступные навыки | `npx skills add MrPippi/MJP-Paper-Skills --list` |
| Установить один навык | `npx skills add MrPippi/MJP-Paper-Skills --skill paper-dialog-ui` |
| Установить всё для выбранных инструментов, без запросов | `npx skills add MrPippi/MJP-Paper-Skills --skill '*' -a claude-code codex -y` |
| Установить для всех ваших проектов (напр. `~/.claude/skills/`) | добавьте `-g` к любой команде `add` |
| Обновить установленные навыки | `npx skills update` |
| Удалить навык | `npx skills remove paper-dialog-ui` |

<details>
<summary>Ручная установка</summary>

Скопируйте `MJP-Paper-Skills/.claude/skills/` в папку, из которой ваш ИИ-инструмент загружает навыки:

| Инструмент | Типичный путь в проекте |
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
> Пути к навыкам различаются в зависимости от инструмента и версии; сверьтесь с документацией вашего инструмента. Многие инструменты также читают `.agents/skills/` как общее расположение.

**Инструмент не поддерживает Agent Skills?** Укажите в его файле инструкций (`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, …) на навыки:

```markdown
Before writing Paper plugin code, find the matching skill in <skills-folder>/skills-registry.yml
(by trigger_keywords) and follow its SKILL.md, plus the files in its references/ folder.
```

### 2. Попросите то, что вам нужно

Опишите нужную функциональность обычным языком. Инструмент сопоставит ваш запрос с описанием и ключевыми словами-триггерами каждого навыка:

```text
"Отправь игроку сообщение в action bar с помощью пакета"
"Перехвати ServerboundChatPacket и отфильтруй определённые слова"
"Создай собственную сущность Zombie с уникальным ИИ преследования"
"Покажи границу мира, которую видит только этот игрок"
```

---

## Каталог навыков

30 навыков, все с проверенной компиляцией на Paper 1.21.11 и 26.2. Просматривайте их с фильтрами и полными шаблонами на [сайте документации](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills); машиночитаемый индекс — [`Skills/skills-registry.yml`](Skills/skills-registry.yml).

### NMS (16 навыков, требуется Paperweight userdev)

| Категория | Навык | Что делает |
|----------|-------|--------------|
| Пакеты | [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | Отправка пользовательских clientbound-пакетов одному игроку, группе или всем |
| Пакеты | [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | Перехват и изменение пакетов в конвейере Netty |
| Сущности | [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | Пользовательские сущности NMS с ИИ на основе PathfinderGoal |
| Сущности | [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | Динамические атрибуты через AttributeMap и AttributeModifier |
| Игроки | [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | Внедрение скинов через GameProfile для внешности NPC |
| Игроки | [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | Фейковые игроки (боты) на базе ServerPlayer без клиента |
| Данные | [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | Чтение и запись NBT через CompoundTag для предметов, сущностей и блок-сущностей |
| Данные | [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | Компоненты предметов через DataComponentType |
| Мир | [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | Пользовательские блок-сущности с NBT, тиками и синхронизацией с клиентом |
| Мир | [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | Прямой доступ к блокам через LevelChunk и ChunkSection |
| Мир | [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | Эффекты частиц через ClientboundLevelParticlesPacket |
| Отображение | [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | Скорборды, цели и команды |
| Отображение | [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | Индивидуальные боссбары для каждого игрока через ServerBossEvent |
| Интерфейс | [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | GUI-контейнеры на основе AbstractContainerMenu |
| Мост | [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | Доступ к NMS через рефлексию без Paperweight |
| Мост | [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | Паттерн Adapter для поддержки NMS нескольких версий |

### Paper API (14 навыков, требуется только `paper-api`)

| Категория | Навык | Что делает |
|----------|-------|--------------|
| Интерфейс | [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | Экраны Dialog API с колбэками в основном потоке |
| Интерфейс | [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | GUI-сундуки на InventoryHolder с постраничной навигацией и защитой от кликов |
| Данные | [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | Репозиторий SQLite с миграциями через `user_version` и единственным потоком записи |
| Данные | [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | Неизменяемые объекты конфигурации, версионирование конфигурации и языковые файлы на MiniMessage |
| Интеграция | [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | API между плагинами через ServicesManager |
| Интеграция | [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | Хуки мягких зависимостей для Vault и PlaceholderAPI |
| Интеграция | [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | Встроенный JSON HTTP API, привязанный к localhost, с ограничением частоты запросов |
| Сеть | [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | Фильтрация пакетов через PacketEvents или ProtocolLib |
| Сеть | [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | Границы мира, время, погода и скрытые игроки для отдельных игроков |
| Геймплей | [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | Боевая метка PvP с учётом авторства урона и обработкой выхода из игры во время боя |
| Геймплей | [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | Поиск безопасной точки, случайная телепортация, асинхронная телепортация и перезарядки |
| Геймплей | [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | Мультивалютная книга учёта, эскроу и провайдер экономики для Vault |
| Команды | [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | Команды Brigadier, регистрируемые через `LifecycleEvents.COMMANDS` |
| Мир | [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | Одноразовые миры и сброс арен |

---

## Как это работает

```text
Your request ──▶ skill description ──▶ SKILL.md ──▶ references/ ──▶ Generated code
                 (trigger keywords)     (template,     (build.gradle,
                                        inputs,        paper-plugin.yml,
                                        fallbacks)     threading, naming)
```

1. Агент сопоставляет ваш запрос с навыком по его описанию и ключевым словам-триггерам.
2. Он читает `SKILL.md` навыка (шаблон, входные и выходные данные, заметки о потокобезопасности, запасной вариант) и `examples.md`.
3. Он применяет настройку сборки платформы, включённую в `references/` и сгенерированную из [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) или [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md).
4. Он следует правилам работы с потоками и именования Mojang, включённым в `references/` и сгенерированным из [`Skills/_shared/`](Skills/_shared).

Для API, не охваченных шаблонами, [краткий справочник по NMS](docs/paper-nms) описывает пакеты, сущности, конвейер Netty и мост Bukkit ↔ NMS.

---

## Совместимость

| Параметр | Поддерживается |
|------|-----------|
| Minecraft / Paper | 1.21.11 и 26.2 (шаблоны по умолчанию написаны под 26.2; отличия 1.21.11 помечены `// @1.21.11:`) |
| Paper dev bundle | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| Java | 21 (1.21.11) / 25 (26.2) |
| Сборка | Gradle 8.11.2+ (проверено на 9.8.1), Groovy DSL |
| Paperweight userdev | `2.0.0-beta.24` (только навыки NMS; `reobfJar` не нужен) |
| Shadow (необязательно) | `com.gradleup.shadow` `9.6.1`, для многомодульных сборок (`nms-version-adapter`) |
| Мягкие зависимости | VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0 |

Канонические шаблоны `build.gradle` и `paper-plugin.yml` находятся в двух файлах `PLATFORM.md`. Обновляетесь с шаблонов 1.21.x? См. [CHANGELOG.md](CHANGELOG.md) и раздел 5 в [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md).

---

## Структура репозитория

```text
MJP-Paper-Skills/
├── .claude/skills/           # Готовая для копирования папка навыков (зеркало Skills/, кроме папок PLATFORM)
├── Skills/                   # Канонические исходники навыков
│   ├── skills-registry.yml   # Индекс всех 30 навыков (paper-nms + paper-api)
│   ├── _shared/              # Правила работы с потоками и именования, общие для всех навыков
│   ├── paper-nms/PLATFORM.md # Шаблоны build.gradle / paper-plugin.yml для NMS, таблица версий
│   ├── paper-api/PLATFORM.md # Настройка сборки Paper API, координаты мягких зависимостей
│   ├── nms/<skill-id>/       # SKILL.md + examples.md + references/ (16 навыков NMS)
│   └── paper/<skill-id>/     # SKILL.md + examples.md + references/ (14 навыков Paper API)
├── scripts/                  # sync-skill-references.mjs (references/), extract-skill-java.mjs (проверка компиляции)
├── verify/                   # Gradle-проект, компилирующий извлечённые шаблоны для каждой версии
├── docs/paper-nms/           # Краткий справочник по API NMS
├── web/                      # Сайт документации на Next.js (статический экспорт на GitHub Pages)
├── CHANGELOG.md
└── CLAUDE.md                 # Инструкции для мейнтейнеров и ИИ-агентов, работающих в этом репозитории
```

---

## Участие в разработке

Вклад приветствуется. Чтобы добавить навык:

1. Создайте `Skills/nms/<slug>/` или `Skills/paper/<slug>/` с файлами `SKILL.md` и `examples.md` (не менее двух примеров).
2. Продублируйте его по тому же пути в `.claude/skills/`, затем выполните `node scripts/sync-skill-references.mjs`, чтобы сгенерировать его папку `references/` (запускайте заново при изменении `PLATFORM.md` или файла из `_shared/`).
3. Добавьте запись в оба файла `skills-registry.yml`.
4. Добавьте страницу сайта `web/data/skills/<slug>.md` и её английский текст `web/data/skills/en/<slug>.md`, затем обновите ожидаемый список в `web/tests/skills-api.data.test.ts`.
5. Убедитесь, что шаблоны компилируются под Paper 1.21.11 и 26.2. CI запускает это для каждого pull request, затрагивающего `Skills/`; чтобы запустить локально (JDK 25 для 26.2, JDK 21 для 1.21.11):

   ```bash
   node scripts/extract-skill-java.mjs 26.2
   cd verify && ./gradlew compileSkills -Pmc=26.2
   ```

[`CLAUDE.md`](CLAUDE.md) описывает полный процесс и инварианты репозитория. Чтобы работать над сайтом документации:

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI запускает те же проверки для каждого pull request. Стек и скрипты сайта описаны в [`web/README.md`](web/README.md).

---

## Лицензия

[MIT](LICENSE) © MrPippi

Не является официальным продуктом Minecraft. Не одобрено Mojang или Microsoft и не связано с ними.
