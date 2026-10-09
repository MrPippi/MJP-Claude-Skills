# MJP-Paper-Skills — Minecraft Paper Agent Skills

**Minecraft Paper 1.21.11 / 26.x 플러그인 개발을 위한, 컴파일 검증이 완료된 [Agent Skills](https://agentskills.io)입니다. 공식 Mojang 이름을 사용하는 저수준 NMS(net.minecraft.server)와 순수 Paper API를 모두 다룹니다.**

각 스킬은 AI 코딩 도구가 플러그인 코드를 생성하기 전에 읽는 `SKILL.md`입니다. 이 스킬들은 개방형 Agent Skills 형식을 사용하므로 Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI 및 `SKILL.md`를 불러오는 모든 도구에서 동작합니다. 스킬을 지원하지 않는 도구에서도 파일을 참조할 수 있으며, 모든 스킬은 일반 참고 문서로도 충분히 읽을 수 있습니다.

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> 문서 사이트: **[mrpippi.github.io/MJP-Paper-Skills](https://mrpippi.github.io/MJP-Paper-Skills)** · 릴리스 노트: [CHANGELOG.md](CHANGELOG.md)

---

## 플랫폼

| 항목 | 상세 |
|------|---------|
| **MC 버전** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **NMS 명명** | 공식 Mojang 이름 (Minecraft는 26.1부터 난독화되지 않습니다) |
| **빌드 도구** | Gradle 8.11.2+ (9.8.1에서 검증) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **스킬 형식** | [Agent Skills](https://agentskills.io) (`SKILL.md` + YAML frontmatter) |

> 1.21.x 템플릿에서 업그레이드하시나요? [CHANGELOG.md](CHANGELOG.md)와 [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)의 마이그레이션 노트(5절)를 참고하십시오.

---

## 스킬

두 가지 트랙으로 구성된 30개의 스킬이며, 모두 Paper 1.21.11과 26.2를 대상으로 컴파일 검증되었습니다.

- **NMS** (스킬 16개, `Skills/nms/`): 패킷, Netty 가로채기, 커스텀 엔티티, NBT / 데이터 컴포넌트, GUI, 스코어보드, 보스바, 파티클, 청크, 가짜 플레이어, 리플렉션 및 멀티 버전 어댑터. Paperweight userdev가 필요합니다.
- **Paper API** (스킬 14개, `Skills/paper/`): Dialog, 상자 GUI, SQLite, 설정 및 언어 파일, 플러그인 간 API, 소프트 의존성, 패킷 필터, PvP 및 경제 게임플레이, Brigadier 명령어, 일회용 월드. `paper-api`만 필요합니다.

👉 **플랫폼과 카테고리별로 필터링할 수 있는 전체 카탈로그 보기: [mrpippi.github.io/MJP-Paper-Skills/docs/skills](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)**

기계가 읽을 수 있는 색인(ID, 트리거 키워드, 입력 및 출력)은 [`Skills/skills-registry.yml`](Skills/skills-registry.yml)입니다.

---

## 빠른 시작

### 1. 스킬 설치

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
```

`MJP-Paper-Skills/.claude/skills/`를 AI 도구가 스킬을 불러오는 폴더로 복사합니다.

| 도구 | 일반적인 프로젝트 경로 |
|------|---------------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex, Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # 사용하는 도구에 맞게 대상 경로를 조정하십시오
```

> 스킬 경로는 도구와 버전에 따라 다릅니다. 사용하는 도구의 문서를 확인하십시오. `.agents/skills/`는 많은 도구가 공유 위치로 읽습니다.

**Agent Skills를 지원하지 않는 도구인가요?** 해당 도구의 지침 파일(`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md` 등)이 스킬을 가리키도록 설정하십시오.

```markdown
Paper 플러그인 코드를 작성하기 전에 <skills-folder>/skills-registry.yml에서
(trigger_keywords 기준으로) 일치하는 스킬을 찾아 해당 SKILL.md를 따르고,
그 안에서 참조하는 PLATFORM.md 및 _shared/ 노트도 함께 따르십시오.
```

### 2. 스킬 사용

필요한 내용을 일상적인 언어로 설명하면, 도구가 요청을 각 스킬의 설명 및 트리거 키워드와 대조하여 일치시킵니다.

```
"플레이어에게 패킷으로 액션바 메시지를 보내줘"
"ServerboundChatPacket을 가로채서 특정 단어를 필터링해줘"
"자체 추적 AI를 가진 커스텀 Zombie 엔티티를 만들어줘"
```

에이전트는 코드를 생성하기 전에 일치하는 `SKILL.md`, 플랫폼 설정([`PLATFORM.md`](Skills/paper-nms/PLATFORM.md)) 및 공유 스레딩/명명 노트를 읽습니다.

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
MJP-Paper-Skills/
├── .claude/skills/           ← 바로 복사해 쓸 수 있는 스킬 폴더 (PLATFORM 폴더를 제외하고 Skills/를 미러링)
├── Skills/                   ← 표준 스킬 소스
│   ├── skills-registry.yml   ← 스킬 30개 (paper-nms + paper-api)
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md, paper-threading.md
│   ├── paper-nms/PLATFORM.md ← NMS build.gradle / paper-plugin.yml 템플릿, 버전 표
│   ├── paper-api/PLATFORM.md ← Paper API build.gradle, 소프트 의존성 좌표
│   ├── nms/<skill-id>/       ← SKILL.md + examples.md (NMS 스킬 16개)
│   └── paper/<skill-id>/     ← SKILL.md + examples.md (Paper API 스킬 14개)
├── docs/paper-nms/           ← NMS API 빠른 참조 (packets, entities, network, bridge)
├── web/                      ← Next.js 문서 사이트 (정적 내보내기 → GitHub Pages)
├── .github/workflows/        ← ci.yml (PR 검사), nextjs.yml (배포), Claude 워크플로
├── CHANGELOG.md
└── CLAUDE.md                 ← 이 저장소에서 작업하는 AI 에이전트를 위한 유지관리자 지침
```

---

## 개발

```bash
cd web
npm ci
npx tsc --noEmit   # 타입 검사
npm test           # characterization 테스트 (node:test + tsx)
npm run build      # web/out/ 로 정적 내보내기
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
