# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**Mojang 公式名称を使用する Paper 26.x 上の、低レベルな Minecraft NMS（net.minecraft.server）開発向けに厳選された [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) ライブラリです。**

MJP-Claude-Skills は、コンパイル検証済みの NMS スキルテンプレートを提供します。Claude Code はプラグインのコードを生成する前にこれらを読み込みます。パケット、Netty によるインターセプト、カスタムエンティティ、NBT / データコンポーネント、GUI、スコアボード、ボスバー、パーティクル、チャンク、リフレクションベースのアクセス、マルチバージョンアダプターを扱います。

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> 変更履歴：[CHANGELOG.md](CHANGELOG.md)

---

## プラットフォーム

| 項目 | 詳細 |
|------|------|
| **MC バージョン** | 26.2（Paper stable） |
| **Paper dev bundle** | `26.2.build.132-stable` |
| **NMS の命名** | Mojang 公式名称（Minecraft は 26.1 以降、難読化されていません） |
| **ビルドツール** | Gradle 8.11.2+（9.8.1 で検証済み）+ Paperweight userdev `2.0.0-beta.24` |
| **Java** | 25（toolchain。Paper 26.x の最小要件） |
| **スキルランタイム** | `.claude/skills/`（Claude Code） |

> 1.21.x テンプレートからアップグレードしますか？ [CHANGELOG.md](CHANGELOG.md) と、[`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)（セクション 5）の移行ノートを参照してください。

---

## スキル

| Skill ID | カテゴリ | 用途 |
|----------|----------|------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | `ServerPlayer.connection.send()` で Clientbound パケットを送信 |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | Netty パイプラインに `ChannelDuplexHandler` を注入してパケットを傍受・変更 |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | `Goal` ベースの AI を持つカスタム NMS モブ |
| [`nms-attribute-modifier`](Skills/nms/nms-attribute-modifier/SKILL.md) | nms-entity | `AttributeModifier` によるエンティティ属性の読み取り・変更 |
| [`nms-nbt-manipulation`](Skills/nms/nms-nbt-manipulation/SKILL.md) | nms-data | `CompoundTag` / `ValueOutput` によるアイテムの `custom_data` とエンティティ NBT の操作 |
| [`nms-data-component`](Skills/nms/nms-data-component/SKILL.md) | nms-data | アイテムの `DataComponentType` システム（カスタムデータ、スタックサイズ、エンチャント…） |
| [`nms-custom-menu`](Skills/nms/nms-custom-menu/SKILL.md) | nms-ui | Bukkit `InventoryHolder` ブリッジを備えた `AbstractContainerMenu` GUI |
| [`nms-scoreboard`](Skills/nms/nms-scoreboard/SKILL.md) | nms-display | スコアボードパケットによるプレイヤーごとのサイドバーとチーム |
| [`nms-boss-event`](Skills/nms/nms-boss-event/SKILL.md) | nms-display | `ServerBossEvent` によるプレイヤーごとのボスバー |
| [`nms-player-profile`](Skills/nms/nms-player-profile/SKILL.md) | nms-player | NPC とプレイヤーヘッド用の `GameProfile` スキン |
| [`nms-particle-effect`](Skills/nms/nms-particle-effect/SKILL.md) | nms-world | `ClientboundLevelParticlesPacket` によるクライアント側パーティクル |
| [`nms-block-entity`](Skills/nms/nms-block-entity/SKILL.md) | nms-world | 永続化、ティック処理、クライアント同期を備えたカスタム `BlockEntity` |
| [`nms-chunk-access`](Skills/nms/nms-chunk-access/SKILL.md) | nms-world | `LevelChunk` / セクションへの直接アクセスとブロックの一括編集 |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | Paperweight のコンパイル依存関係なしで、`MethodHandle` をキャッシュして NMS にアクセス |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | 実行時ディスパッチを備えたマルチバージョン対応アダプターインターフェース |

---

## クイックスタート

### 1. スキルランタイムをインストールする

`.claude/skills/` をプロジェクトのルートにコピーします。

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. スキルを使う

Claude Code は `.claude/skills/` を自動的に読み込みます。トリガーキーワードを使って必要な内容を伝えてください。

```
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

Claude Code は、コードを生成する前に、該当する `SKILL.md`、[`PLATFORM.md`](Skills/paper-nms/PLATFORM.md)、および共有のスレッド・命名に関するノートを読み込みます。

---

## 依存関係

### スキルから生成されるプラグイン

| 依存関係 | バージョン | 備考 |
|----------|------------|------|
| Paper サーバー | 26.2 | テンプレートは build 132 に対してコンパイル検証済み |
| Paper dev bundle（`paperweight.paperDevBundle`） | `26.2.build.132-stable` | 26.x 形式：`<mc>.build.<n>-<channel>`（[一覧](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)） |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | プレリリース版。`reobfJar` は不要 |
| Gradle | 8.11.2+ | 9.8.1 で検証済み |
| JDK | 25 | Toolchain と `options.release` |
| `com.gradleup.shadow`（任意） | `9.6.1` | マルチモジュール／バンドルビルドの場合のみ（`nms-version-adapter` を参照） |
| `paper-api`（リフレクション専用 / core モジュール） | `26.2.build.132-stable` | `compileOnly` |

標準の `build.gradle` と `paper-plugin.yml` は [`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md) にあります。

### ドキュメントサイト（`web/`）

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — 完全な一覧とスクリプトは [`web/README.md`](web/README.md) を参照してください。

---

## リポジトリ構成

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

## 開発

```bash
cd web
npm ci
npx tsc --noEmit   # type check
npm test           # characterization tests (node:test + tsx)
npm run build      # static export to web/out/
```

CI は、すべてのプルリクエストで同じチェックを実行します（`.github/workflows/ci.yml`）。

---

## 新しいスキルの追加

1. `Skills/nms/<slug>/SKILL.md` と `examples.md` を作成する（例は 2 つ以上）
2. `.claude/skills/nms/<slug>/` にミラーリングする
3. 両方の `skills-registry.yml` にエントリを追加する
4. `web/data/skills/<slug>.md` を追加し、`web/tests/skills-api.data.test.ts` の期待リストを更新する
5. マージする前に、現在の dev bundle に対してテンプレートクラスをコンパイルする

8 ステップの完全な手順と不変条件については `CLAUDE.md` を参照してください。

---

## ライセンス

MIT
