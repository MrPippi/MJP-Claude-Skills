# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**Отобранная библиотека [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) для низкоуровневой разработки на Minecraft NMS (net.minecraft.server) под Paper 26.x с официальными названиями Mojang.**

MJP-Claude-Skills предоставляет шаблоны NMS-навыков с проверенной компиляцией, которые Claude Code читает перед генерацией кода плагина — они охватывают пакеты, перехват через Netty, пользовательские сущности, NBT / data components, GUI, скорборды, боссбары, частицы, чанки, доступ через рефлексию и адаптеры для нескольких версий.

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> Примечания к выпуску: [CHANGELOG.md](CHANGELOG.md)

---

## Платформа

| Параметр | Подробности |
|------|---------|
| **Версия MC** | 26.2 (стабильная Paper) |
| **Paper dev bundle** | `26.2.build.132-stable` |
| **Именование NMS** | Официальные названия Mojang (Minecraft не обфусцирован начиная с 26.1) |
| **Инструмент сборки** | Gradle 8.11.2+ (проверено на 9.8.1) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 25 (toolchain; минимум для Paper 26.x) |
| **Среда выполнения навыков** | `.claude/skills/` (Claude Code) |

> Обновляетесь с шаблонов 1.21.x? См. [CHANGELOG.md](CHANGELOG.md) и заметки по миграции в [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (раздел 5).

---

## Навыки

| ID навыка | Категория | Назначение |
|----------|----------|---------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | Отправка Clientbound-пакетов через `ServerPlayer.connection.send()` |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | Внедрение `ChannelDuplexHandler` в pipeline Netty для перехвата/изменения пакетов |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | Пользовательские NMS-мобы с ИИ на основе `Goal` |
| [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | nms-entity | Чтение/изменение атрибутов сущностей через `AttributeModifier` |
| [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | nms-data | `custom_data` предметов и NBT сущностей через `CompoundTag` / `ValueOutput` |
| [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | nms-data | Система `DataComponentType` предметов (custom data, размер стопки, зачарования…) |
| [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | nms-ui | GUI на основе `AbstractContainerMenu` с мостом к Bukkit `InventoryHolder` |
| [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | nms-display | Боковые панели и команды для отдельных игроков через пакеты скорборда |
| [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | nms-display | Боссбары для отдельных игроков через `ServerBossEvent` |
| [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | nms-player | Скины через `GameProfile` для NPC и голов игроков |
| [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | nms-world | Клиентские частицы через `ClientboundLevelParticlesPacket` |
| [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | nms-world | Пользовательский `BlockEntity` с сохранением, тиками и синхронизацией с клиентом |
| [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | nms-world | Прямой доступ к `LevelChunk` / секциям и массовое изменение блоков |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | Доступ к NMS с кэшированием через `MethodHandle` без зависимости Paperweight на этапе компиляции |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | Интерфейс адаптера для нескольких версий с диспетчеризацией во время выполнения |

---

## Быстрый старт

### 1. Установите среду выполнения навыков

Скопируйте `.claude/skills/` в корень вашего проекта:

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. Используйте навык

Claude Code автоматически подхватывает `.claude/skills/`. Опишите, что вам нужно, используя ключевые слова-триггеры:

```
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

Claude Code читает соответствующий `SKILL.md`, [`PLATFORM.md`](Skills/paper-nms/PLATFORM.md) и общие заметки по потокам и именованию перед генерацией кода.

---

## Зависимости

### Плагины, генерируемые из навыков

| Зависимость | Версия | Примечания |
|------------|---------|-------|
| Сервер Paper | 26.2 | Компиляция шаблонов проверена на сборке 132 |
| Paper dev bundle (`paperweight.paperDevBundle`) | `26.2.build.132-stable` | Формат 26.x: `<mc>.build.<n>-<channel>` ([список](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)) |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | Предварительный выпуск; `reobfJar` не нужен |
| Gradle | 8.11.2+ | Проверено на 9.8.1 |
| JDK | 25 | Toolchain и `options.release` |
| `com.gradleup.shadow` (необязательно) | `9.6.1` | Только для многомодульных / собираемых в один JAR сборок (см. `nms-version-adapter`) |
| `paper-api` (модули только с рефлексией / core) | `26.2.build.132-stable` | `compileOnly` |

Канонические `build.gradle` и `paper-plugin.yml` находятся в [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md).

### Сайт документации (`web/`)

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — полный список и скрипты в [`web/README.md`](web/README.md).

---

## Структура репозитория

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

## Разработка

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # characterization tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI выполняет те же проверки для каждого pull request (`.github/workflows/ci.yml`).

---

## Добавление новых навыков

1. Создайте `Skills/nms/<slug>/SKILL.md` + `examples.md` (≥ 2 примера)
2. Продублируйте в `.claude/skills/nms/<slug>/`
3. Добавьте запись в оба файла `skills-registry.yml`
4. Добавьте `web/data/skills/<slug>.md` и обновите ожидаемый список в `web/tests/skills-api.data.test.ts`
5. Перед слиянием скомпилируйте классы шаблона с текущим dev bundle

Полный 8-шаговый процесс и инварианты см. в `CLAUDE.md`.

---

## Лицензия

MIT
