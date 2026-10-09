# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**공식 Mojang 이름을 사용하는 Paper 1.21.11 / 26.x 기반의 저수준 Minecraft NMS(net.minecraft.server) 개발을 위한 [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) 큐레이션 라이브러리입니다.**

MJP-Claude-Skills는 Claude Code가 플러그인 코드를 생성하기 전에 읽는, 컴파일 검증이 완료된 NMS 스킬 템플릿을 제공합니다. 패킷, Netty 가로채기, 커스텀 엔티티, NBT / 데이터 컴포넌트, GUI, 스코어보드, 보스바, 파티클, 청크, 리플렉션 기반 접근 및 멀티 버전 어댑터를 다룹니다.

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> 릴리스 노트: [CHANGELOG.md](CHANGELOG.md)

---

## 플랫폼

| 항목 | 상세 |
|------|---------|
| **MC 버전** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **NMS 명명** | 공식 Mojang 이름 (Minecraft는 26.1부터 난독화되지 않습니다) |
| **빌드 도구** | Gradle 8.11.2+ (9.8.1에서 검증) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **스킬 런타임** | `.claude/skills/` (Claude Code) |

> 1.21.x 템플릿에서 업그레이드하시나요? [CHANGELOG.md](CHANGELOG.md)와 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)의 마이그레이션 노트(5절)를 참고하십시오.

---

## 스킬

두 가지 트랙으로 구성된 30개의 스킬입니다. **NMS** 스킬은 Paperweight userdev가 필요하며, **Paper API** 스킬은 `paper-api`만 필요합니다. 모든 템플릿은 Paper 1.21.11과 26.2를 대상으로 컴파일 검증되었습니다.

### NMS 스킬 (`Skills/nms/`)

| 스킬 ID | 카테고리 | 목적 |
|----------|----------|---------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | `ServerPlayer.connection.send()`를 통해 Clientbound 패킷을 전송합니다 |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | Netty 파이프라인에 `ChannelDuplexHandler`를 주입하여 패킷을 가로채거나 수정합니다 |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | `Goal` 기반 AI를 갖는 커스텀 NMS 몹을 만듭니다 |
| [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | nms-entity | `AttributeModifier`로 엔티티 속성을 읽고 수정합니다 |
| [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | nms-data | `CompoundTag` / `ValueOutput`을 통한 아이템 `custom_data` 및 엔티티 NBT를 다룹니다 |
| [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | nms-data | 아이템 `DataComponentType` 시스템 (custom data, 스택 크기, 마법 부여 등) |
| [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | nms-ui | Bukkit `InventoryHolder` 브리지를 갖는 `AbstractContainerMenu` GUI |
| [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | nms-display | 스코어보드 패킷을 이용한 플레이어별 사이드바와 팀 |
| [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | nms-display | `ServerBossEvent`를 이용한 플레이어별 보스바 |
| [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | nms-player | NPC와 플레이어 머리를 위한 `GameProfile` 스킨 |
| [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | nms-world | `ClientboundLevelParticlesPacket`을 이용한 클라이언트 측 파티클 |
| [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | nms-world | 영속성, 틱, 클라이언트 동기화를 갖춘 커스텀 `BlockEntity` |
| [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | nms-world | `LevelChunk` / 섹션 직접 접근 및 대량 블록 편집 |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | Paperweight 컴파일 의존성 없이 `MethodHandle` 캐시로 NMS에 접근합니다 |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | 런타임 디스패치를 갖는 멀티 버전 어댑터 인터페이스 |
| [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | nms-player | 실제 NMS `ServerPlayer`를 기반으로 하는 클라이언트 없는 가짜 플레이어(봇) |

### Paper API 스킬 (NMS 없음, `Skills/paper/`)

| 스킬 ID | 카테고리 | 목적 |
|----------|----------|---------|
| [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | paper-ui | 메인 스레드에서 안전한 콜백을 갖는 Paper Dialog API 화면 |
| [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | paper-ui | 페이지 처리와 클릭 방지 기능을 갖춘 `InventoryHolder` 상자 GUI |
| [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | paper-data | SQLite 리포지토리, `user_version` 마이그레이션, 단일 라이터 플러셔 |
| [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | paper-data | 불변 설정 스냅샷, `config-version`, MiniMessage 언어 파일 |
| [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | paper-integration | `ServicesManager`를 통한 플러그인 간 API, jar 버전 불일치에 관대합니다 |
| [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | paper-integration | 소프트 의존성 Hook/Bridge, Vault, PlaceholderAPI 확장 |
| [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | paper-integration | 내장 JDK `HttpServer` JSON API (localhost, 요청 제한, 스냅샷) |
| [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | paper-network | PacketEvents / ProtocolLib 패킷 필터 (Netty 스레드 안전, fail-open) |
| [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | paper-network | 플레이어별 월드 보더, 시간, 날씨 및 가시성 착시 효과 |
| [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | paper-gameplay | 피해 귀속과 로그아웃 처리를 포함한 PvP 전투 태그 |
| [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | paper-gameplay | 안전 지점 탐색, RTP, 비동기 텔레포트, 대기 시간 및 쿨다운 |
| [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | paper-gameplay | 다중 통화 원장, 에스크로 및 Vault 제공자 |
| [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | paper-command | `LifecycleEvents.COMMANDS`를 통한 Brigadier 명령어 |
| [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | paper-world | 일회용 월드와 초기화 가능한 아레나 |

---

## 빠른 시작

### 1. 스킬 런타임 설치

`.claude/skills/`를 프로젝트 루트에 복사합니다.

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. 스킬 사용

Claude Code는 `.claude/skills/`를 자동으로 인식합니다. 트리거 키워드를 사용하여 필요한 내용을 설명하십시오.

```
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

Claude Code는 코드를 생성하기 전에 일치하는 `SKILL.md`, [`PLATFORM.md`](Skills/paper-nms/PLATFORM.md) 및 공유 스레딩/명명 노트를 읽습니다.

---

## 의존성

### 스킬로 생성되는 플러그인

| 의존성 | 버전 | 비고 |
|------------|---------|-------|
| Paper 서버 | 1.21.11 / 26.2 | 템플릿은 빌드 132 기준으로 컴파일 검증되었습니다 |
| Paper dev bundle (`paperweight.paperDevBundle`) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | 26.x 형식: `<mc>.build.<n>-<channel>` ([목록](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)) |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | 프리 릴리스; `reobfJar` 불필요 |
| Gradle | 8.11.2+ | 9.8.1에서 검증 |
| JDK | 25 | Toolchain 및 `options.release` |
| `com.gradleup.shadow` (선택 사항) | `9.6.1` | 멀티 모듈 / 번들 빌드에서만 사용 (`nms-version-adapter` 참조) |
| `paper-api` (리플렉션 전용 / 코어 모듈) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

표준 `build.gradle`과 `paper-plugin.yml`은 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)(NMS 스킬)와 [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md)(Paper API 스킬, 소프트 의존성 좌표 포함: VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0)에 있습니다.

### 문서 웹사이트 (`web/`)

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — 전체 목록과 스크립트는 [`web/README.md`](web/README.md)를 참고하십시오.

---

## 저장소 구조

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

## 개발

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # characterization tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI는 모든 풀 리퀘스트에서 동일한 검사를 실행합니다 (`.github/workflows/ci.yml`).

---

## 새 스킬 추가

1. `Skills/nms/<slug>/` 또는 `Skills/paper/<slug>/`에 `SKILL.md` + `examples.md`를 생성합니다 (예제 2개 이상)
2. `.claude/skills/` 아래 동일한 경로에 미러링합니다
3. 두 `skills-registry.yml` 파일 모두에 항목을 추가합니다
4. `web/data/skills/<slug>.md`를 추가하고 `web/tests/skills-api.data.test.ts`의 기대 목록을 업데이트합니다
5. 병합하기 전에 Paper 1.21.11과 26.2를 대상으로 템플릿 클래스를 컴파일합니다

전체 9단계 절차와 불변 규칙은 `CLAUDE.md`를 참고하십시오.

---

## 라이선스

MIT
