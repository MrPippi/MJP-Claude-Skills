<div align="center">

# MJP-Paper-Skills

**Agent Skills com compilação verificada para o desenvolvimento de plugins do Minecraft Paper**

NMS de baixo nível com os nomes oficiais da Mojang e Paper API pura, para qualquer ferramenta de programação com IA que leia `SKILL.md`

[![Paper](https://img.shields.io/badge/Paper-1.21.11%20%7C%2026.2-2ea44f)](https://papermc.io)
[![Java](https://img.shields.io/badge/Java-21%20%7C%2025-orange)](https://adoptium.net)
[![Skills](https://img.shields.io/badge/skills-31-blue)](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)
[![Agent Skills](https://img.shields.io/badge/format-Agent%20Skills-8a63d2)](https://agentskills.io)
[![Skills compile](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml/badge.svg)](https://github.com/MrPippi/MJP-Paper-Skills/actions/workflows/skills-compile.yml)
[![License: MIT](https://img.shields.io/github/license/MrPippi/MJP-Paper-Skills)](LICENSE)

[**Documentação**](https://mrpippi.github.io/MJP-Paper-Skills) · [**Catálogo de skills**](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills) · [**Changelog**](CHANGELOG.md)

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · Português (BR) · [Русский](README.ru.md)

</div>

---

Ferramentas de programação com IA costumam errar detalhes em plugins do Paper: nomes de NMS desatualizados ou ofuscados, chamadas ao Bukkit a partir do Netty ou de threads assíncronas, APIs que mudaram entre versões. O MJP-Paper-Skills dá ao seu agente um guia validado no lugar. Cada skill é um `SKILL.md` com um modelo de código, a configuração de build, as regras de threads e os planos de contingência que o agente lê antes de escrever código.

## Destaques

- **Compilação verificada**: a CI compila todo modelo completo contra o Paper **1.21.11** e **26.2** a cada alteração; as linhas específicas de cada versão são marcadas no próprio código.
- **Nomes oficiais da Mojang**: o código NMS usa o Paperweight userdev e os nomes que o Minecraft distribui sem ofuscação desde a 26.1.
- **Seguro entre threads por design**: cada skill informa em qual thread cada chamada é executada (principal, Netty IO ou assíncrona).
- **Independente de ferramenta**: o formato aberto [Agent Skills](https://agentskills.io) funciona com Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI e outras.
- **Duas trilhas**: 16 skills de NMS para trabalho de baixo nível e 15 skills de Paper API que precisam apenas do `paper-api`.
- **Documentação legível**: cada skill também é publicada no [site de documentação](https://mrpippi.github.io/MJP-Paper-Skills), em inglês e chinês tradicional.

## Conteúdo

- [Início rápido](#início-rápido)
- [Catálogo de skills](#catálogo-de-skills)
- [Como funciona](#como-funciona)
- [Compatibilidade](#compatibilidade)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## Início rápido

### 1. Instale as skills

A [CLI de skills](https://github.com/vercel-labs/skills) instala diretamente deste repositório. Você só precisa do [Node.js](https://nodejs.org) para o `npx`; não há conta nem cadastro.

1. Na pasta raiz do seu projeto de plugin, execute:

   ```bash
   npx skills add MrPippi/MJP-Paper-Skills
   ```

2. Escolha as skills que quiser. A CLI detecta suas ferramentas de IA (Claude Code, Codex, Cursor, …) e pergunta para quais instalar, e se deve usar links simbólicos (recomendado) ou copiar.
3. Confirme o resultado com `npx skills list`.

Cada skill inclui a configuração de build e as regras de threads de que precisa na sua própria pasta `references/`, então instalar uma única skill isoladamente funciona.

| Objetivo | Comando |
|------|---------|
| Listar as skills disponíveis | `npx skills add MrPippi/MJP-Paper-Skills --list` |
| Instalar uma skill | `npx skills add MrPippi/MJP-Paper-Skills --skill paper-dialog-ui` |
| Instalar tudo para ferramentas específicas, sem perguntas | `npx skills add MrPippi/MJP-Paper-Skills --skill '*' -a claude-code codex -y` |
| Instalar para todos os seus projetos (p. ex. `~/.claude/skills/`) | adicione `-g` a qualquer comando `add` |
| Atualizar as skills instaladas | `npx skills update` |
| Remover uma skill | `npx skills remove paper-dialog-ui` |

<details>
<summary>Instalação manual</summary>

Copie `MJP-Paper-Skills/.claude/skills/` para a pasta de onde a sua ferramenta de IA carrega skills:

| Ferramenta | Caminho comum no projeto |
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
> Os caminhos das skills variam entre ferramentas e versões; consulte a documentação da sua ferramenta. Muitas também leem `.agents/skills/` como local compartilhado.

**Sua ferramenta não oferece suporte a Agent Skills?** Aponte o arquivo de instruções dela (`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, …) para as skills:

```markdown
Before writing Paper plugin code, find the matching skill in <skills-folder>/skills-registry.yml
(by trigger_keywords) and follow its SKILL.md, plus the files in its references/ folder.
```

### 2. Peça o que precisa

Descreva a funcionalidade em linguagem natural. A ferramenta compara o seu pedido com a descrição e as palavras-chave de gatilho de cada skill:

```text
"Envie uma mensagem na action bar para um jogador usando um pacote"
"Intercepte o ServerboundChatPacket e filtre certas palavras"
"Crie uma entidade Zombie personalizada com IA própria de perseguição"
"Mostre uma borda de mundo que só este jogador consiga ver"
```

---

## Catálogo de skills

31 skills, todas com compilação verificada contra o Paper 1.21.11 e 26.2. Explore-as com filtros e modelos completos no [site de documentação](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills); o índice legível por máquina é [`Skills/skills-registry.yml`](Skills/skills-registry.yml).

### NMS (16 skills, exige Paperweight userdev)

| Categoria | Skill | O que faz |
|----------|-------|--------------|
| Pacotes | [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | Envia pacotes clientbound personalizados a um jogador, a um grupo ou a todos |
| Pacotes | [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | Intercepta e modifica pacotes no pipeline do Netty |
| Entidades | [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | Entidades NMS personalizadas com IA baseada em PathfinderGoal |
| Entidades | [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | Atributos dinâmicos com AttributeMap e AttributeModifier |
| Jogadores | [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | Injeção de skin via GameProfile para a aparência de NPCs |
| Jogadores | [`nms-fake-player`](Skills/nms/nms-fake-player/SKILL.md) | Jogadores falsos (bots) com ServerPlayer sem cliente |
| Dados | [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | Leitura e escrita de NBT com CompoundTag em itens, entidades e block entities |
| Dados | [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | Componentes de item com DataComponentType |
| Mundo | [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | Block entities personalizadas com NBT, ticks e sincronização com o cliente |
| Mundo | [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | Acesso direto a blocos via LevelChunk e ChunkSection |
| Mundo | [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | Efeitos de partículas com ClientboundLevelParticlesPacket |
| Exibição | [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | Scoreboards, objetivos e times |
| Exibição | [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | Boss bars independentes por jogador com ServerBossEvent |
| Interface | [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | GUIs de contêiner baseadas em AbstractContainerMenu |
| Ponte | [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | Acesso ao NMS por reflexão, sem Paperweight |
| Ponte | [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | Padrão Adapter para suporte a NMS em várias versões |

### Paper API (15 skills, exige apenas `paper-api`)

| Categoria | Skill | O que faz |
|----------|-------|--------------|
| Interface | [`paper-dialog-ui`](Skills/paper/paper-dialog-ui/SKILL.md) | Telas com a Dialog API e callbacks na thread principal |
| Interface | [`paper-chest-gui`](Skills/paper/paper-chest-gui/SKILL.md) | GUIs de baú com InventoryHolder, paginação e proteção contra cliques |
| Dados | [`paper-sqlite-repository`](Skills/paper/paper-sqlite-repository/SKILL.md) | Repositório SQLite com migrações via `user_version` e uma única thread de escrita |
| Dados | [`paper-config-lang`](Skills/paper/paper-config-lang/SKILL.md) | Objetos de configuração imutáveis, versionamento de configuração e arquivos de idioma com MiniMessage |
| Integração | [`paper-service-api`](Skills/paper/paper-service-api/SKILL.md) | APIs entre plugins por meio do ServicesManager |
| Integração | [`paper-softdepend-hook`](Skills/paper/paper-softdepend-hook/SKILL.md) | Hooks de dependências opcionais para Vault e PlaceholderAPI |
| Integração | [`paper-embedded-http`](Skills/paper/paper-embedded-http/SKILL.md) | API HTTP JSON embutida, vinculada ao localhost, com limitação de taxa |
| Integração | [`paper-discord-bridge`](Skills/paper/paper-discord-bridge/SKILL.md) | Ponte de chat bidirecional com o Discord usando apenas o JDK: webhooks de saída, Gateway de entrada |
| Rede | [`paper-packetevents-filter`](Skills/paper/paper-packetevents-filter/SKILL.md) | Filtragem de pacotes com PacketEvents ou ProtocolLib |
| Rede | [`paper-client-side-effects`](Skills/paper/paper-client-side-effects/SKILL.md) | Bordas de mundo, horário, clima e jogadores ocultos por jogador |
| Jogabilidade | [`paper-combat-tag`](Skills/paper/paper-combat-tag/SKILL.md) | Marcação de combate PvP com atribuição de dano e tratamento de saída durante o combate |
| Jogabilidade | [`paper-safe-teleport`](Skills/paper/paper-safe-teleport/SKILL.md) | Busca de locais seguros, teletransporte aleatório, teletransporte assíncrono e cooldowns |
| Jogabilidade | [`paper-economy-ledger`](Skills/paper/paper-economy-ledger/SKILL.md) | Livro-razão multimoeda, custódia (escrow) e um provedor de economia para o Vault |
| Comandos | [`paper-brigadier-command`](Skills/paper/paper-brigadier-command/SKILL.md) | Comandos Brigadier registrados via `LifecycleEvents.COMMANDS` |
| Mundo | [`paper-disposable-world`](Skills/paper/paper-disposable-world/SKILL.md) | Mundos descartáveis e reinício de arenas |

---

## Como funciona

```text
Your request ──▶ skill description ──▶ SKILL.md ──▶ references/ ──▶ Generated code
                 (trigger keywords)     (template,     (build.gradle,
                                        inputs,        paper-plugin.yml,
                                        fallbacks)     threading, naming)
```

1. O agente associa o seu pedido a uma skill por meio da descrição e das palavras-chave de gatilho.
2. Ele lê o `SKILL.md` da skill (modelo, entradas, saídas, notas de segurança entre threads, contingência) e o `examples.md`.
3. Aplica a configuração de build da plataforma incluída em `references/`, gerada a partir de [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) ou [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md).
4. Segue as regras de threads e de nomenclatura da Mojang incluídas em `references/`, geradas a partir de [`Skills/_shared/`](Skills/_shared).

Para APIs além dos modelos, a [referência rápida de NMS](docs/paper-nms) cobre pacotes, entidades, o pipeline do Netty e a ponte Bukkit ↔ NMS.

---

## Compatibilidade

| Item | Suportado |
|------|-----------|
| Minecraft / Paper | 1.21.11 e 26.2 (os modelos usam 26.2 por padrão; as diferenças da 1.21.11 são marcadas com `// @1.21.11:`) |
| Paper dev bundle | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| Java | 21 (1.21.11) / 25 (26.2) |
| Build | Gradle 8.11.2+ (verificado com 9.8.1), Groovy DSL |
| Paperweight userdev | `2.0.0-beta.24` (somente skills de NMS; `reobfJar` não é necessário) |
| Shadow (opcional) | `com.gradleup.shadow` `9.6.1`, para builds multimódulo (`nms-version-adapter`) |
| Dependências opcionais | VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents 2.13.0, ProtocolLib 5.3.0, sqlite-jdbc 3.49.1.0 |

Os modelos canônicos de `build.gradle` e `paper-plugin.yml` estão nos dois arquivos `PLATFORM.md`. Atualizando a partir dos modelos 1.21.x? Veja [CHANGELOG.md](CHANGELOG.md) e a seção 5 de [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md).

---

## Estrutura do repositório

```text
MJP-Paper-Skills/
├── .claude/skills/           # Pasta de skills pronta para copiar (espelha Skills/, exceto as pastas PLATFORM)
├── Skills/                   # Fontes canônicas das skills
│   ├── skills-registry.yml   # Índice das 31 skills (paper-nms + paper-api)
│   ├── _shared/              # Regras de threads e nomenclatura compartilhadas por todas as skills
│   ├── paper-nms/PLATFORM.md # Modelos de build.gradle / paper-plugin.yml para NMS, tabela de versões
│   ├── paper-api/PLATFORM.md # Configuração de build da Paper API, coordenadas das dependências opcionais
│   ├── nms/<skill-id>/       # SKILL.md + examples.md + references/ (16 skills de NMS)
│   └── paper/<skill-id>/     # SKILL.md + examples.md + references/ (15 skills de Paper API)
├── scripts/                  # sync-skill-references.mjs (references/), extract-skill-java.mjs (verificação de compilação)
├── verify/                   # Projeto Gradle que compila os modelos extraídos para cada versão
├── docs/paper-nms/           # Referência rápida da API do NMS
├── web/                      # Site de documentação em Next.js (exportação estática para o GitHub Pages)
├── CHANGELOG.md
└── CLAUDE.md                 # Instruções para mantenedores e agentes de IA que trabalham neste repositório
```

---

## Contribuindo

Contribuições são bem-vindas. Para adicionar uma skill:

1. Crie `Skills/nms/<slug>/` ou `Skills/paper/<slug>/` com `SKILL.md` e `examples.md` (pelo menos dois exemplos).
2. Espelhe-a no mesmo caminho em `.claude/skills/` e depois execute `node scripts/sync-skill-references.mjs` para gerar a pasta `references/` dela (execute-o novamente sempre que um `PLATFORM.md` ou um arquivo de `_shared/` mudar).
3. Adicione a entrada nos dois arquivos `skills-registry.yml`.
4. Adicione a página do site `web/data/skills/<slug>.md` e o seu corpo em inglês `web/data/skills/en/<slug>.md`; depois atualize a lista esperada em `web/tests/skills-api.data.test.ts`.
5. Garanta que os modelos compilem contra o Paper 1.21.11 e 26.2. A CI executa isso em todo pull request que altere `Skills/`; para executar localmente (JDK 25 para 26.2, JDK 21 para 1.21.11):

   ```bash
   node scripts/extract-skill-java.mjs 26.2
   cd verify && ./gradlew compileSkills -Pmc=26.2
   ```

O [`CLAUDE.md`](CLAUDE.md) documenta o processo completo e os invariantes do repositório. Para trabalhar no site de documentação:

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # tests (node:test + tsx)
npm run build      # static export to web/out/
```

A CI executa as mesmas verificações em cada pull request. Veja [`web/README.md`](web/README.md) para conhecer a stack e os scripts do site.

---

## Licença

[MIT](LICENSE) © MrPippi

Não é um produto oficial do Minecraft. Não é aprovado pela Mojang nem pela Microsoft, nem associado a elas.
