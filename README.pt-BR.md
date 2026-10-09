# MJP-Paper-Skills — Minecraft Paper Agent Skills

**[Agent Skills](https://agentskills.io) com compilação verificada para desenvolvimento de plugins do Minecraft Paper 1.21.11 / 26.x — NMS de baixo nível (net.minecraft.server) com os nomes oficiais da Mojang e Paper API pura.**

Cada skill é um `SKILL.md` que a sua ferramenta de programação com IA lê antes de gerar código de plugin. As skills usam o formato aberto Agent Skills, portanto funcionam com Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI e qualquer outra ferramenta que carregue `SKILL.md`. Ferramentas sem suporte a skills ainda podem referenciar os arquivos, e cada skill pode ser lida normalmente como documentação de referência.

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> Site de documentação: **[mrpippi.github.io/MJP-Paper-Skills](https://mrpippi.github.io/MJP-Paper-Skills)** · Notas de lançamento: [CHANGELOG.md](CHANGELOG.md)

---

## Plataforma

| Item | Detalhes |
|------|---------|
| **Versão do MC** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **Nomenclatura NMS** | Nomes oficiais da Mojang (o Minecraft não é ofuscado desde a 26.1) |
| **Ferramenta de build** | Gradle 8.11.2+ (verificado com 9.8.1) + Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **Formato das skills** | [Agent Skills](https://agentskills.io) (`SKILL.md` + frontmatter YAML) |

> Atualizando a partir dos modelos 1.21.x? Veja [CHANGELOG.md](CHANGELOG.md) e as notas de migração em [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) (seção 5).

---

## Skills

30 skills em duas trilhas, todas com compilação verificada contra o Paper 1.21.11 e 26.2:

- **NMS** (16 skills, `Skills/nms/`): pacotes, interceptação via Netty, entidades personalizadas, NBT / data components, GUIs, scoreboards, boss bars, partículas, chunks, jogadores falsos, reflexão e adaptadores multiversão. Exige o Paperweight userdev.
- **Paper API** (14 skills, `Skills/paper/`): Dialogs, GUIs de baú, SQLite, arquivos de configuração e de idioma, APIs entre plugins, dependências opcionais, filtros de pacotes, jogabilidade de PvP e economia, comandos Brigadier, mundos descartáveis. Exige apenas `paper-api`.

👉 **Explore o catálogo completo, filtrável por plataforma e categoria: [mrpippi.github.io/MJP-Paper-Skills/docs/skills](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)**

O índice legível por máquina (IDs, palavras-chave de gatilho, entradas e saídas) é [`Skills/skills-registry.yml`](Skills/skills-registry.yml).

---

## Início rápido

### 1. Instale as skills

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
```

Copie `MJP-Paper-Skills/.claude/skills/` para a pasta de onde a sua ferramenta de IA carrega skills:

| Ferramenta | Caminho comum no projeto |
|------|---------------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex, Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # ajuste o destino para a sua ferramenta
```

> Os caminhos das skills variam entre ferramentas e versões; consulte a documentação da sua ferramenta. `.agents/skills/` é lido por muitas ferramentas como um local compartilhado.

**Ferramenta sem suporte a Agent Skills?** Aponte o arquivo de instruções dela (`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`, …) para as skills:

```markdown
Antes de escrever código de plugin Paper, encontre a skill correspondente em <skills-folder>/skills-registry.yml
(por trigger_keywords) e siga o seu SKILL.md, além das notas de PLATFORM.md e _shared/ que ele referencia.
```

### 2. Use uma skill

Descreva o que você precisa em linguagem natural; a ferramenta compara o seu pedido com a descrição e as palavras-chave de gatilho de cada skill:

```
"Envie uma mensagem na action bar para um jogador usando um pacote"
"Intercepte o ServerboundChatPacket e filtre certas palavras"
"Crie uma entidade Zombie personalizada com IA própria de perseguição"
```

O agente lê o `SKILL.md` correspondente, a configuração da plataforma ([`PLATFORM.md`](Skills/paper-nms/PLATFORM.md)) e as notas compartilhadas de threading / nomenclatura antes de gerar o código.

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
MJP-Paper-Skills/
├── .claude/skills/           ← Pasta de skills pronta para copiar (espelha Skills/, exceto as pastas PLATFORM)
├── Skills/                   ← Fontes canônicas das skills
│   ├── skills-registry.yml   ← 30 skills (paper-nms + paper-api)
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md, paper-threading.md
│   ├── paper-nms/PLATFORM.md ← Modelos de build.gradle / paper-plugin.yml do NMS, tabela de versões
│   ├── paper-api/PLATFORM.md ← build.gradle da Paper API, coordenadas das dependências opcionais
│   ├── nms/<skill-id>/       ← SKILL.md + examples.md (16 skills NMS)
│   └── paper/<skill-id>/     ← SKILL.md + examples.md (14 skills da Paper API)
├── docs/paper-nms/           ← Referência rápida da API NMS (pacotes, entidades, rede, bridge)
├── web/                      ← Site de documentação Next.js (exportação estática → GitHub Pages)
├── .github/workflows/        ← ci.yml (verificações de PR), nextjs.yml (deploy), workflows do Claude
├── CHANGELOG.md
└── CLAUDE.md                 ← Instruções para os mantenedores e agentes de IA que trabalham neste repositório
```

---

## Desenvolvimento

```bash
cd web
npm ci
npx tsc --noEmit   # verificação de tipos
npm test           # testes de caracterização (node:test + tsx)
npm run build      # exportação estática para web/out/
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
