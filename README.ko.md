<div align="center">

# MJP-Paper-Skills

**컴파일 검증을 마친 Minecraft Paper 플러그인 개발용 Agent Skills**

공식 Mojang 이름을 사용하는 저수준 NMS와 순수 Paper API를 지원하며, `SKILL.md`를 읽는 모든 AI 코딩 도구에서 사용할 수 있습니다

[![Paper](https://img.shields.io/badge/Paper-1.21.11%20%7C%2026.2-2ea44f)](https://papermc.io)
[![Java](https://img.shields.io/badge/Java-21%20%7C%2025-orange)](https://adoptium.net)
[![Skills](https://img.shields.io/badge/skills-30-blue)](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)
[![Agent Skills](https://img.shields.io/badge/format-Agent%20Skills-8a63d2)](https://agentskills.io)
[![Skills compile](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml/badge.svg)](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml)
[![License: MIT](https://img.shields.io/github/license/MrPippi/MJP-Paper-Skills)](LICENSE)

[**문서**](https://mrpippi.github.io/MJP-Paper-Skills) · [**스킬 카탈로그**](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills) · [**변경 이력**](CHANGELOG.md)

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · 한국어 · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)

</div>

---

AI 코딩 도구는 Paper 플러그인에서 미묘한 실수를 자주 합니다. 오래되었거나 난독화된 NMS 이름, Netty 스레드나 비동기 스레드에서의 Bukkit 호출, 버전 사이에 바뀐 API 등이 그 예입니다. MJP-Paper-Skills는 검증된 플레이북을 에이전트에게 제공합니다. 각 스킬은 코드 템플릿, 빌드 설정, 스레딩 규칙, 폴백을 담은 `SKILL.md`이며, 에이전트는 코드를 작성하기 전에 이를 읽습니다.

## 주요 특징

- **컴파일 검증 완료**: CI가 변경이 있을 때마다 완성된 모든 템플릿을 Paper **1.21.11**과 **26.2** 모두에서 컴파일합니다. 버전별로 다른 줄은 인라인으로 표시되어 있습니다.
- **공식 Mojang 이름**: NMS 코드는 Paperweight userdev와, 26.1부터 Minecraft가 난독화 없이 제공하는 이름을 사용합니다.
- **스레드 안전 설계**: 각 스킬은 모든 호출이 어느 스레드(메인, Netty IO, 비동기)에서 실행되는지 명시합니다.
- **도구에 종속되지 않음**: 개방형 [Agent Skills](https://agentskills.io) 형식은 Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI 등에서 동작합니다.
- **두 가지 트랙**: 저수준 작업을 위한 NMS 스킬 16개와 `paper-api`만 필요한 Paper API 스킬 14개가 있습니다.
- **읽기 쉬운 문서**: 모든 스킬은 [문서 사이트](https://mrpippi.github.io/MJP-Paper-Skills)에도 게시되어 있으며, 영어와 중국어 번체로 제공됩니다.

## 목차

- [빠른 시작](#빠른-시작)
- [스킬 카탈로그](#스킬-카탈로그)
- [동작 방식](#동작-방식)
- [호환성](#호환성)
- [저장소 구조](#저장소-구조)
- [기여하기](#기여하기)
- [라이선스](#라이선스)

---

## 빠른 시작

### 1. 스킬 설치

[skills CLI](https://github.com/vercel-labs/skills)로 이 저장소에서 바로 설치합니다. `npx`를 위한 [Node.js](https://nodejs.org)만 있으면 되며, 계정이나 가입은 필요 없습니다.

1. 플러그인 프로젝트의 루트 폴더에서 다음을 실행합니다.

   ```bash
   npx skills add MrPippi/MJP-Paper-Skills
   ```

2. 설치할 스킬을 고릅니다. CLI가 AI 도구(Claude Code, Codex, Cursor 등)를 감지하고, 어떤 도구용으로 설치할지와 심볼릭 링크(권장) 또는 복사 중 무엇을 쓸지 묻습니다.
3. `npx skills list`로 결과를 확인합니다.

각 스킬은 필요한 빌드 설정과 스레딩 규칙을 자체 `references/` 폴더에 포함하므로, 스킬 하나만 설치해도 동작합니다.

| 목표 | 명령 |
|------|---------|
| 사용 가능한 스킬 목록 보기 | `npx skills add MrPippi/MJP-Paper-Skills --list` |
| 스킬 하나 설치 | `npx skills add MrPippi/MJP-Paper-Skills --skill paper-dialog-ui` |
| 지정한 도구용으로 전체를 프롬프트 없이 설치 | `npx skills add MrPippi/MJP-Paper-Skills --skill '*' -a claude-code codex -y` |
| 모든 프로젝트용으로 설치 (예: `~/.claude/skills/`) | 어떤 `add` 명령에든 `-g`를 추가 |
| 설치된 스킬 업데이트 | `npx skills update` |
| 스킬 제거 | `npx skills remove paper-dialog-ui` |

<details>
<summary>수동 설치</summary>

`MJP-Paper-Skills/.claude/skills/`를 AI 도구가 스킬을 불러오는 폴더로 복사합니다.

| 도구 | 일반적인 프로젝트 경로 |
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
> 스킬 경로는 도구와 버전에 따라 다릅니다. 사용하는 도구의 문서를 확인하십시오. 많은 도구는 공유 위치로 `.agents/skills/`도 읽습니다.

**Agent Skills를 지원하지 않는 도구인가요?** 해당 도구의 지침 파일(`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md` 등)이 스킬을 가리키도록 설정하십시오.

```markdown
Before writing Paper plugin code, find the matching skill in <skills-folder>/skills-registry.yml
(by trigger_keywords) and follow its SKILL.md, plus the files in its references/ folder.
```

### 2. 필요한 내용 요청하기

원하는 기능을 일상적인 언어로 설명하십시오. 도구가 요청을 각 스킬의 설명 및 트리거 키워드와 대조하여 일치하는 스킬을 찾습니다.

```text
"패킷으로 플레이어에게 액션바 메시지를 보내고 싶어"
"ServerboundChatPacket을 가로채서 특정 단어를 필터링하고 싶어"
"자체 추적 AI를 가진 커스텀 Zombie 엔티티를 만들고 싶어"
"이 플레이어에게만 보이는 월드 보더를 표시하고 싶어"
```

---

## 스킬 카탈로그

30개의 스킬은 모두 Paper 1.21.11과 26.2를 대상으로 컴파일 검증되었습니다. 필터와 전체 템플릿은 [문서 사이트](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)에서 확인할 수 있으며, 기계가 읽을 수 있는 색인은 [`Skills/skills-registry.yml`](Skills/skills-registry.yml)입니다.

### NMS (스킬 16개, Paperweight userdev 필요)

| 카테고리 | 스킬 | 기능 |
|----------|-------|--------------|
| 패킷 | [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | 커스텀 Clientbound 패킷을 한 명, 그룹 또는 전체에게 전송 |
| 패킷 | [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | Netty 파이프라인에서 패킷을 가로채고 수정 |
| 엔티티 | [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | PathfinderGoal AI를 갖춘 커스텀 NMS 엔티티 |
| 엔티티 | [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | AttributeMap과 AttributeModifier를 이용한 동적 속성 |
| 플레이어 | [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | NPC 외형을 위한 GameProfile 스킨 주입 |
| 플레이어 | [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | 클라이언트 없는 ServerPlayer 가짜 플레이어(봇) |
| 데이터 | [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | 아이템, 엔티티, 블록 엔티티의 CompoundTag NBT 읽기 및 쓰기 |
| 데이터 | [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | DataComponentType 아이템 컴포넌트 |
| 월드 | [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | NBT, 틱 처리, 클라이언트 동기화를 갖춘 커스텀 블록 엔티티 |
| 월드 | [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | LevelChunk와 ChunkSection에 대한 직접적인 블록 접근 |
| 월드 | [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | ClientboundLevelParticlesPacket을 이용한 파티클 효과 |
| 표시 | [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | 스코어보드, 오브젝티브, 팀 |
| 표시 | [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | ServerBossEvent를 이용한 플레이어별 보스바 |
| UI | [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | AbstractContainerMenu 기반의 컨테이너 GUI |
| 브리지 | [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | Paperweight 없이 리플렉션으로 NMS에 접근 |
| 브리지 | [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | 멀티 버전 NMS 지원을 위한 어댑터 패턴 |

### Paper API (스킬 14개, `paper-api`만 필요)

| 카테고리 | 스킬 | 기능 |
|----------|-------|--------------|
| UI | [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | 콜백을 메인 스레드에서 처리하는 Dialog API 화면 |
| UI | [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | 페이지 넘김과 클릭 방지를 갖춘 InventoryHolder 상자 GUI |
| 데이터 | [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | `user_version` 마이그레이션과 단일 쓰기 스레드를 갖춘 SQLite 리포지토리 |
| 데이터 | [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | 불변 설정 객체, 설정 버전 관리, MiniMessage 언어 파일 |
| 연동 | [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | ServicesManager를 통한 플러그인 간 API |
| 연동 | [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | Vault와 PlaceholderAPI용 소프트 의존성 훅 |
| 연동 | [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | localhost에 바인딩되고 요청 제한을 갖춘 내장 JSON HTTP API |
| 네트워크 | [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | PacketEvents 또는 ProtocolLib을 이용한 패킷 필터링 |
| 네트워크 | [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | 플레이어별 월드 보더, 시간, 날씨, 숨겨진 플레이어 |
| 게임플레이 | [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | 피해 귀속과 전투 중 로그아웃 처리를 갖춘 PvP 전투 태그 |
| 게임플레이 | [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | 안전한 위치 탐색, 무작위 텔레포트, 비동기 텔레포트, 쿨다운 |
| 게임플레이 | [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | 다중 통화 장부, 에스크로, Vault 경제 제공자 |
| 명령어 | [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | `LifecycleEvents.COMMANDS`로 등록하는 Brigadier 명령어 |
| 월드 | [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | 일회용 월드와 아레나 초기화 |

---

## 동작 방식

```text
Your request ──▶ skill description ──▶ SKILL.md ──▶ references/ ──▶ Generated code
                 (trigger keywords)     (template,     (build.gradle,
                                        inputs,        paper-plugin.yml,
                                        fallbacks)     threading, naming)
```

1. 에이전트는 설명과 트리거 키워드를 통해 요청에 맞는 스킬을 찾습니다.
2. 해당 스킬의 `SKILL.md`(템플릿, 입력, 출력, 스레드 안전 노트, 폴백)와 `examples.md`를 읽습니다.
3. `references/`에 포함된 플랫폼 빌드 설정을 적용합니다. 이는 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 또는 [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md)에서 생성됩니다.
4. `references/`에 포함된 스레딩과 Mojang 명명 규칙을 따릅니다. 이는 [`Skills/_shared/`](Skills/_shared)에서 생성됩니다.

템플릿에서 다루지 않는 API는 [NMS 빠른 참조](docs/paper-nms)에서 패킷, 엔티티, Netty 파이프라인, Bukkit ↔ NMS 브리징을 다룹니다.

---

## 호환성

| 항목 | 지원 |
|------|-----------|
| Minecraft / Paper | 1.21.11 및 26.2 (템플릿은 26.2가 기본이며, 1.21.11과 다른 부분은 `// @1.21.11:`로 표시) |
| Paper dev bundle | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| Java | 21 (1.21.11) / 25 (26.2) |
| 빌드 | Gradle 8.11.2+ (9.8.1에서 검증), Groovy DSL |
| Paperweight userdev | `2.0.0-beta.24` (NMS 스킬 전용, `reobfJar` 불필요) |
| Shadow (선택 사항) | `com.gradleup.shadow` `9.6.1`, 멀티 모듈 빌드용 (`nms-version-adapter`) |
| 소프트 의존성 | VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0 |

표준 `build.gradle` 및 `paper-plugin.yml` 템플릿은 두 `PLATFORM.md` 파일에 있습니다. 1.21.x 템플릿에서 업그레이드하시나요? [CHANGELOG.md](CHANGELOG.md)와 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)의 5절을 참고하십시오.

---

## 저장소 구조

```text
MJP-Paper-Skills/
├── .claude/skills/           # 바로 복사해 쓸 수 있는 스킬 폴더 (PLATFORM 폴더를 제외하고 Skills/를 미러링)
├── Skills/                   # 표준 스킬 소스
│   ├── skills-registry.yml   # 전체 30개 스킬 색인 (paper-nms + paper-api)
│   ├── _shared/              # 모든 스킬이 공유하는 스레딩 및 명명 규칙
│   ├── paper-nms/PLATFORM.md # NMS build.gradle / paper-plugin.yml 템플릿, 버전 표
│   ├── paper-api/PLATFORM.md # Paper API 빌드 설정, 소프트 의존성 좌표
│   ├── nms/<skill-id>/       # SKILL.md + examples.md + references/ (NMS 스킬 16개)
│   └── paper/<skill-id>/     # SKILL.md + examples.md + references/ (Paper API 스킬 14개)
├── scripts/                  # sync-skill-references.mjs (references/), extract-skill-java.mjs (컴파일 검사)
├── verify/                   # 추출한 템플릿을 버전별로 컴파일하는 Gradle 프로젝트
├── docs/paper-nms/           # NMS API 빠른 참조
├── web/                      # Next.js 문서 사이트 (GitHub Pages로 정적 내보내기)
├── CHANGELOG.md
└── CLAUDE.md                 # 이 저장소에서 작업하는 AI 에이전트를 위한 유지관리자 지침
```

---

## 기여하기

기여를 환영합니다. 스킬을 추가하려면 다음 절차를 따르십시오.

1. `Skills/nms/<slug>/` 또는 `Skills/paper/<slug>/`에 `SKILL.md`와 `examples.md`(예제 2개 이상)를 생성합니다.
2. `.claude/skills/` 아래 동일한 경로에 미러링한 다음, `node scripts/sync-skill-references.mjs`를 실행하여 `references/` 폴더를 생성합니다(`PLATFORM.md` 또는 `_shared/` 파일이 변경될 때마다 다시 실행).
3. 두 `skills-registry.yml` 파일 모두에 항목을 추가합니다.
4. 사이트 페이지 `web/data/skills/<slug>.md`와 영어 본문 `web/data/skills/en/<slug>.md`를 추가한 다음, `web/tests/skills-api.data.test.ts`의 기대 목록을 업데이트합니다.
5. 템플릿이 Paper 1.21.11과 26.2에서 컴파일되는지 확인합니다. `Skills/`를 건드리는 모든 풀 리퀘스트에서 CI가 이를 실행합니다. 로컬에서 실행하려면 (26.2는 JDK 25, 1.21.11은 JDK 21):

   ```bash
   node scripts/extract-skill-java.mjs 26.2
   cd verify && ./gradlew compileSkills -Pmc=26.2
   ```

전체 절차와 저장소 불변 규칙은 [`CLAUDE.md`](CLAUDE.md)에 문서화되어 있습니다. 문서 사이트 작업은 다음과 같이 진행합니다.

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI는 모든 풀 리퀘스트에서 동일한 검사를 실행합니다. 사이트의 스택과 스크립트는 [`web/README.md`](web/README.md)를 참고하십시오.

---

## 라이선스

[MIT](LICENSE) © MrPippi

Minecraft 공식 제품이 아닙니다. Mojang 또는 Microsoft의 승인을 받았거나 이들과 관련이 있지 않습니다.
