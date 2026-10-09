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

30 skills em duas trilhas: as skills **NMS** exigem o Paperweight userdev; as skills da **Paper API** exigem apenas `paper-api`. Todos os modelos têm compilação verificada contra o Paper 1.21.11 e 26.2.

### Skills NMS (`Skills/nms/`)

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
| [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | nms-player | Jogadores falsos (bots) sem cliente, baseados em um `ServerPlayer` real do NMS |

### Skills da Paper API (sem NMS, `Skills/paper/`)

| ID da skill | Categoria | Finalidade |
|----------|----------|---------|
| [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | paper-ui | Telas da Paper Dialog API com callbacks seguros para a thread principal |
| [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | paper-ui | GUIs de baú com `InventoryHolder`, paginação e proteção contra cliques |
| [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | paper-data | Repositórios SQLite, migrações com `user_version`, flusher de escritor único |
| [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | paper-data | Snapshots imutáveis de configuração, `config-version`, arquivos de idioma MiniMessage |
| [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | paper-integration | APIs entre plugins via `ServicesManager`, tolerantes a diferenças de versão entre jars |
| [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | paper-integration | Hook/Bridge de dependência opcional, Vault, expansões do PlaceholderAPI |
| [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | paper-integration | API JSON com `HttpServer` embutido do JDK (localhost, limite de taxa, snapshots) |
| [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | paper-network | Filtros de pacotes com PacketEvents / ProtocolLib (seguros para a thread do Netty, fail-open) |
| [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | paper-network | Ilusões por jogador de borda do mundo, hora, clima e visibilidade |
| [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | paper-gameplay | Marcação de combate PvP com atribuição de dano e tratamento de logout |
| [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | paper-gameplay | Busca de local seguro, RTP, teletransportes assíncronos, tempos de preparação e cooldowns |
| [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | paper-gameplay | Livro-razão multimoeda, custódia (escrow) e um provedor do Vault |
| [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | paper-command | Comandos Brigadier via `LifecycleEvents.COMMANDS` |
| [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | paper-world | Mundos descartáveis e arenas reiniciáveis |

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

O `build.gradle` e o `paper-plugin.yml` canônicos ficam em [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (skills NMS) e [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md) (skills da Paper API, com as coordenadas das dependências opcionais: VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0).

### Site de documentação (`web/`)

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — lista completa e scripts em [`web/README.md`](web/README.md).

---

## Estrutura do repositório

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

1. Crie `Skills/nms/<slug>/` ou `Skills/paper/<slug>/` com `SKILL.md` + `examples.md` (≥ 2 exemplos)
2. Espelhe no mesmo caminho em `.claude/skills/`
3. Adicione a entrada nos dois arquivos `skills-registry.yml`
4. Adicione `web/data/skills/<slug>.md` e atualize a lista esperada em `web/tests/skills-api.data.test.ts`
5. Compile as classes do modelo contra o Paper 1.21.11 e 26.2 antes de fazer o merge

Veja `CLAUDE.md` para o processo completo de 9 etapas e os invariantes.

---

## Licença

MIT
