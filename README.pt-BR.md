# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**Uma biblioteca selecionada de [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) para desenvolvimento de baixo nível com NMS (net.minecraft.server) do Minecraft no Paper 1.21.11 / 26.x, com os nomes oficiais da Mojang.**

O MJP-Claude-Skills fornece modelos de skills NMS com compilação verificada que o Claude Code lê antes de gerar código de plugin — cobrindo pacotes, interceptação via Netty, entidades personalizadas, NBT / data components, GUIs, scoreboards, boss bars, partículas, chunks, acesso por reflexão e adaptadores multiversão.

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> Notas de lançamento: [CHANGELOG.md](CHANGELOG.md)

---

## Plataforma

| Item | Detalhes |
|------|---------|
| **Versão do MC** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **Nomenclatura NMS** | Nomes oficiais da Mojang (o Minecraft não é ofuscado desde a 26.1) |
| **Ferramenta de build** | Gradle 8.11.2+ (verificado com 9.8.1) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **Runtime das skills** | `.claude/skills/` (Claude Code) |

> Atualizando a partir dos modelos 1.21.x? Veja [CHANGELOG.md](CHANGELOG.md) e as notas de migração em [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (seção 5).

---

## Skills

| ID da skill | Categoria | Finalidade |
|----------|----------|---------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | Enviar pacotes Clientbound via `ServerPlayer.connection.send()` |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | Injetar um `ChannelDuplexHandler` no pipeline do Netty para interceptar/modificar pacotes |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | Mobs NMS personalizados com IA baseada em `Goal` |
| [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | nms-entity | Ler/modificar atributos de entidades com `AttributeModifier` |
| [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | nms-data | `custom_data` de itens e NBT de entidades via `CompoundTag` / `ValueOutput` |
| [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | nms-data | Sistema `DataComponentType` de itens (custom data, tamanho da pilha, encantamentos…) |
| [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | nms-ui | GUIs com `AbstractContainerMenu` e ponte para o `InventoryHolder` do Bukkit |
| [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | nms-display | Barras laterais e equipes por jogador via pacotes de scoreboard |
| [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | nms-display | Boss bars por jogador com `ServerBossEvent` |
| [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | nms-player | Skins via `GameProfile` para NPCs e cabeças de jogadores |
| [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | nms-world | Partículas no lado do cliente com `ClientboundLevelParticlesPacket` |
| [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | nms-world | `BlockEntity` personalizado com persistência, ticking e sincronização com o cliente |
| [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | nms-world | Acesso direto a `LevelChunk` / seções e edições de blocos em massa |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | Acesso ao NMS com cache de `MethodHandle`, sem dependência de compilação do Paperweight |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | Interface de adaptador multiversão com despacho em tempo de execução |

---

## Início rápido

### 1. Instale o runtime das skills

Copie `.claude/skills/` para a raiz do seu projeto:

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. Use uma skill

O Claude Code reconhece `.claude/skills/` automaticamente. Descreva o que você precisa usando palavras-chave de gatilho:

```
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

O Claude Code lê o `SKILL.md` correspondente, o [`PLATFORM.md`](Skills/paper-nms/PLATFORM.md) e as notas compartilhadas de threading/nomenclatura antes de gerar o código.

---

## Dependências

### Plugins gerados a partir das skills

| Dependência | Versão | Observações |
|------------|---------|-------|
| Servidor Paper | 1.21.11 / 26.2 | Os modelos têm compilação verificada na build 132 |
| Paper dev bundle (`paperweight.paperDevBundle`) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | Formato 26.x: `<mc>.build.<n>-<channel>` ([lista](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)) |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | Pré-lançamento; não precisa de `reobfJar` |
| Gradle | 8.11.2+ | Verificado com 9.8.1 |
| JDK | 25 | Toolchain e `options.release` |
| `com.gradleup.shadow` (opcional) | `9.6.1` | Apenas para builds multimódulo / empacotadas (veja `nms-version-adapter`) |
| `paper-api` (módulos somente reflexão / core) | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

O `build.gradle` e o `paper-plugin.yml` canônicos ficam em [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md).

### Site de documentação (`web/`)

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — lista completa e scripts em [`web/README.md`](web/README.md).

---

## Estrutura do repositório

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

## Desenvolvimento

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # characterization tests (node:test + tsx)
npm run build      # static export to web/out/
```

O CI executa as mesmas verificações em cada pull request (`.github/workflows/ci.yml`).

---

## Adicionando novas skills

1. Crie `Skills/nms/<slug>/SKILL.md` + `examples.md` (≥ 2 exemplos)
2. Espelhe em `.claude/skills/nms/<slug>/`
3. Adicione a entrada nos dois arquivos `skills-registry.yml`
4. Adicione `web/data/skills/<slug>.md` e atualize a lista esperada em `web/tests/skills-api.data.test.ts`
5. Compile as classes do modelo contra o dev bundle atual antes de fazer o merge

Veja `CLAUDE.md` para o processo completo de 8 etapas e os invariantes.

---

## Licença

MIT
