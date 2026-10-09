# MJP-Paper-Skills — Minecraft Paper Agent Skills

**Minecraft Paper 1.21.11 / 26.x のプラグイン開発向けに、コンパイル検証済みの [Agent Skills](https://agentskills.io) を提供します。Mojang 公式名称を使う低レベルな NMS（net.minecraft.server）と、純粋な Paper API の両方に対応しています。**

各スキルは、AI コーディングツールがプラグインのコードを生成する前に読み込む `SKILL.md` です。スキルにはオープンな Agent Skills 形式を採用しているため、Claude Code、OpenAI Codex、Cursor、GitHub Copilot、Gemini CLI など、`SKILL.md` を読み込むあらゆるツールで利用できます。スキル非対応のツールでもファイルを参照でき、どのスキルも通常のリファレンスドキュメントとして読めます。

> 🌐 [English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru.md)
>
> ドキュメントサイト：**[mrpippi.github.io/MJP-Paper-Skills](https://mrpippi.github.io/MJP-Paper-Skills)** · リリースノート：[CHANGELOG.md](CHANGELOG.md)

---

## プラットフォーム

| 項目 | 詳細 |
|------|------|
| **MC バージョン** | 1.21.11 / 26.2 |
| **Paper dev bundle** | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` |
| **NMS の命名** | Mojang 公式名称（Minecraft は 26.1 以降、難読化されていません） |
| **ビルドツール** | Gradle 8.11.2+（9.8.1 で検証済み）+ Paperweight userdev `2.0.0-beta.24` |
| **Java** | 21 (1.21.11) / 25 (26.2) |
| **スキル形式** | [Agent Skills](https://agentskills.io)（`SKILL.md` + YAML フロントマター） |

> 1.21.x テンプレートからアップグレードしますか？ [CHANGELOG.md](CHANGELOG.md) と、[`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)（セクション 5）の移行ノートを参照してください。

---

## スキル

スキルは 2 つのトラックに分かれた 30 個で、すべて Paper 1.21.11 と 26.2 に対してコンパイル検証済みです。

- **NMS**（16 スキル、`Skills/nms/`）：パケット、Netty によるインターセプト、カスタムエンティティ、NBT / データコンポーネント、GUI、スコアボード、ボスバー、パーティクル、チャンク、フェイクプレイヤー、リフレクション、マルチバージョンアダプター。Paperweight userdev が必要です。
- **Paper API**（14 スキル、`Skills/paper/`）：Dialog、チェスト GUI、SQLite、設定・言語ファイル、プラグイン間 API、ソフト依存関係、パケットフィルター、PvP とエコノミーのゲームプレイ、Brigadier コマンド、使い捨てワールド。`paper-api` だけで動作します。

👉 **プラットフォームとカテゴリで絞り込める全カタログはこちら：[mrpippi.github.io/MJP-Paper-Skills/docs/skills](https://mrpippi.github.io/MJP-Paper-Skills/docs/skills)**

機械可読なインデックス（ID、トリガーキーワード、入力と出力）は [`Skills/skills-registry.yml`](Skills/skills-registry.yml) です。

---

## クイックスタート

### 1. スキルをインストールする

```bash
git clone https://github.com/MrPippi/MJP-Paper-Skills.git
```

`MJP-Paper-Skills/.claude/skills/` を、お使いの AI ツールがスキルを読み込むフォルダにコピーします。

| ツール | 一般的なプロジェクトパス |
|------|---------------------|
| Claude Code | `.claude/skills/` |
| OpenAI Codex、Gemini CLI | `.agents/skills/` |
| Cursor | `.cursor/skills/` |
| GitHub Copilot | `.github/skills/` |

```bash
cp -r MJP-Paper-Skills/.claude/skills .agents/skills   # adjust the target for your tool
```

> スキルのパスはツールやバージョンによって異なります。お使いのツールのドキュメントを確認してください。`.agents/skills/` は、多くのツールが共有の場所として読み込みます。

**Agent Skills に対応していないツールの場合** は、指示ファイル（`AGENTS.md`、`.cursorrules`、`.github/copilot-instructions.md` など）からスキルを参照するようにします。

```markdown
Paper プラグインのコードを書く前に、<skills-folder>/skills-registry.yml から
（trigger_keywords で）該当するスキルを探し、その SKILL.md と、そこで参照されている PLATFORM.md および _shared/ のノートに従ってください。
```

### 2. スキルを使う

必要な内容を普通の言葉で伝えてください。ツールが、リクエストを各スキルの説明とトリガーキーワードに照らして照合します。

```
"パケットでプレイヤーにアクションバーのメッセージを送信したい"
"ServerboundChatPacket を傍受して特定の単語をフィルターしたい"
"独自の追跡 AI を持つカスタム Zombie エンティティを作成したい"
```

エージェントは、コードを生成する前に、該当する `SKILL.md`、プラットフォーム設定（[`PLATFORM.md`](Skills/paper-nms/PLATFORM.md)）、および共有のスレッド・命名に関するノートを読み込みます。

---

## 依存関係

### スキルから生成されるプラグイン

| 依存関係 | バージョン | 備考 |
|----------|------------|------|
| Paper サーバー | 1.21.11 / 26.2 | テンプレートは build 132 に対してコンパイル検証済み |
| Paper dev bundle（`paperweight.paperDevBundle`） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | 26.x 形式：`<mc>.build.<n>-<channel>`（[一覧](https://repo.papermc.io/repository/maven-public/io/papermc/paper/dev-bundle/maven-metadata.xml)） |
| `io.papermc.paperweight.userdev` | `2.0.0-beta.24` | プレリリース版。`reobfJar` は不要 |
| Gradle | 8.11.2+ | 9.8.1 で検証済み |
| JDK | 25 | Toolchain と `options.release` |
| `com.gradleup.shadow`（任意） | `9.6.1` | マルチモジュール／バンドルビルドの場合のみ（`nms-version-adapter` を参照） |
| `paper-api`（リフレクション専用 / core モジュール） | `1.21.11-R0.1-SNAPSHOT` / `26.2.build.132-stable` | `compileOnly` |

標準の `build.gradle` と `paper-plugin.yml` は、[`Skills/paper-nms/PLATFORM.md`](Skills/paper-nms/PLATFORM.md)（NMS スキル）と [`Skills/paper-api/PLATFORM.md`](Skills/paper-api/PLATFORM.md)（Paper API スキル。ソフト依存関係の座標を含む：VaultAPI 1.7.1、PlaceholderAPI 2.11.6、packetevents 2.13.0、ProtocolLib 5.3.0、sqlite-jdbc 3.49.1.0）にあります。

### ドキュメントサイト（`web/`）

Node.js 24 · Next.js 16.4.0 · React 19.3.0 · TypeScript 6.0.3 · Tailwind CSS 4.3.3 — 完全な一覧とスクリプトは [`web/README.md`](web/README.md) を参照してください。

---

## リポジトリ構成

```
MJP-Paper-Skills/
├── .claude/skills/           ← コピーしてすぐ使えるスキルフォルダ（Skills/ のミラー。PLATFORM フォルダを除く）
├── Skills/                   ← 正規のスキルソース
│   ├── skills-registry.yml   ← 30 スキル（paper-nms + paper-api）
│   ├── _shared/              ← nms-threading.md, nms-obfuscation.md, paper-threading.md
│   ├── paper-nms/PLATFORM.md ← NMS 用 build.gradle / paper-plugin.yml テンプレート、バージョン表
│   ├── paper-api/PLATFORM.md ← Paper API 用 build.gradle、ソフト依存関係の座標
│   ├── nms/<skill-id>/       ← SKILL.md + examples.md（NMS スキル 16 個）
│   └── paper/<skill-id>/     ← SKILL.md + examples.md（Paper API スキル 14 個）
├── docs/paper-nms/           ← NMS API クイックリファレンス（packets, entities, network, bridge）
├── web/                      ← Next.js ドキュメントサイト（静的エクスポート → GitHub Pages）
├── .github/workflows/        ← ci.yml（PR チェック）、nextjs.yml（デプロイ）、Claude ワークフロー
├── CHANGELOG.md
└── CLAUDE.md                 ← このリポジトリで作業する AI エージェント向けのメンテナー用指示
```

---

## 開発

```bash
cd web
npm ci
npx tsc --noEmit   # 型チェック
npm test           # characterization tests (node:test + tsx)
npm run build      # web/out/ への静的エクスポート
```

CI は、すべてのプルリクエストで同じチェックを実行します（`.github/workflows/ci.yml`）。

---

## 新しいスキルの追加

1. `Skills/nms/<slug>/` または `Skills/paper/<slug>/` に `SKILL.md` と `examples.md` を作成する（例は 2 つ以上）
2. `.claude/skills/` 配下の同じパスにミラーリングする
3. 両方の `skills-registry.yml` にエントリを追加する
4. `web/data/skills/<slug>.md` を追加し、`web/tests/skills-api.data.test.ts` の期待リストを更新する
5. マージする前に、Paper 1.21.11 と 26.2 に対してテンプレートクラスをコンパイルする

9 ステップの完全な手順と不変条件については `CLAUDE.md` を参照してください。

---

## ライセンス

MIT
