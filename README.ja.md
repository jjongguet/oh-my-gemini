[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md)

<p align="center">
  <img src="docs/assets/omg_logo.png" alt="oh-my-gemini" width="240" />
</p>

# oh-my-gemini

[![npm version](https://img.shields.io/npm/v/oh-my-gemini-sisyphus?color=cb3837)](https://www.npmjs.com/package/oh-my-gemini-sisyphus)
[![GitHub stars](https://img.shields.io/github/stars/jjongguet/oh-my-gemini?style=flat&color=yellow)](https://github.com/jjongguet/oh-my-gemini/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=flat&logo=github)](https://github.com/sponsors/jjongguet)

> **姉妹プロジェクト:** Claude Code や Codex を使いたいですか？ [oh-my-claudecode (OMC)](https://github.com/Yeachan-Heo/oh-my-claudecode) と [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex) もご覧ください。

**Gemini CLI 向けのマルチエージェント・オーケストレーション。学習コストはほぼゼロ。**

_Gemini CLI を無理に扱う必要はありません。OMG を実行するだけです。_

[クイックスタート](#クイックスタート) • [チームモード](#チームモード推奨) • [機能](#機能) • [CLI リファレンス](#cli-リファレンス) • [要件](#要件)

---

## クイックスタート

**ステップ 1: インストール**

```bash
npm install -g oh-my-gemini-sisyphus
```

**ステップ 2: セットアップ**

```bash
omg setup --scope project
```

**ステップ 3: Gemini を起動**

```bash
omg
```

これで完了です。

`omg` は OMG 拡張を読み込んだ状態で Gemini CLI を起動します。すでに tmux の中にいればそのまま実行され、tmux の外にいる場合は OMG が新しい tmux セッションを自動で作成します。

### 次に試すとよいコマンド

```bash
omg doctor
omg verify
omg hud --watch
```

---

## チームモード（推奨）

OMG は tmux ファーストです。`omg team run` は Gemini 駆動の実ワーカーセッションを調整し、状態を `.omg/state/` に永続化し、長時間の作業に向けたライフサイクルコマンドを提供します。

```bash
# 並列実装またはレビュー
omg team run --task "review src/team and src/cli for reliability gaps" --workers 4

# タスク先頭キーワードでバックエンド/ロールを明示的にルーティング
omg team run --task "/subagents $planner /review /verify ship the release checklist" --workers 3

# 既存の実行状態を確認または再開
omg team status --team oh-my-gemini --json
omg team resume --team oh-my-gemini --max-fix-loop 1

# 完了したら安全に停止
omg team shutdown --team oh-my-gemini --force
```

**デフォルトバックエンド:** `tmux`  
**オプションバックエンド:** 明示的なロールタグ実行向けの `subagents`

---

## なぜ oh-my-gemini なのか？

- **Gemini ネイティブなワークフロー** - Gemini を二次的なプロバイダとして後付けするのではなく、Gemini CLI を中心に構築
- **学習コストの低い入口** - `omg` が対話セッションを起動するので、拡張の配線を覚える必要がありません
- **チームファーストのオーケストレーション** - 永続的なライフサイクル状態と再開可能な実行を備えた協調ワーカー実行
- **検証ゲート付きのデリバリー** - `omg verify` が typecheck、smoke、integration、reliability の各スイートをまとめて実行
- **運用の可視性** - HUD、doctor、状態を持つライフサイクルコマンドにより、実行状況を観測・復旧しやすい
- **スキル対応ランタイム** - `deep-interview`、`review`、`verify`、`handoff` のような再利用可能スキルを CLI と拡張優先フローの両方で利用可能
- **OMC / OMX ファミリーの一員** - OMC（Claude Code）と OMX（Codex）の Gemini 版兄弟プロジェクトとして、Gemini 優先ワークフロー向けに調整済み

---

## 機能

### オーケストレーションモード

| 機能 | 内容 | 用途 |
| ---- | ---- | ---- |
| **Team** | 永続状態、ヘルスチェック、resume/shutdown/cancel 制御を備えたマルチワーカー・オーケストレーション。デフォルトランタイムは tmux | 並列実装、レビュー、長時間の協調タスク |
| **Interactive Launch** | `omg` / `omg launch` が OMG 拡張を読み込んだ Gemini CLI を、現在の tmux pane または新しい tmux セッションで起動 | セットアップの手間を増やさない日常的な対話型 Gemini 開発 |
| **Verify** | `omg verify` が `typecheck`、`smoke`、`integration`、`reliability` にまたがる検証ティアを実行 | リリース確認、信頼性ゲート、CI 向け検証 |
| **HUD** | `omg hud` が永続化されたチーム状態からライブステータス・オーバーレイを描画 | JSON 状態ファイルを追わずにアクティブな実行を監視 |
| **Skills** | `omg skill` が `deep-interview`、`review`、`verify`、`cancel`、`handoff` などの再利用可能プロンプトを提供 | 再現可能なワークフロー、ガイド付き実行、オペレーター引き継ぎ |

### さらに開発者に効くポイント

- **Doctor コマンド** で Node、Gemini CLI、tmux、拡張アセット、`.omg/state` の書き込み可否を確認
- `.omg/state` 配下での **決定論的な状態永続化** により再開可能なオーケストレーションを実現
- `extensions/oh-my-gemini/` による **拡張優先パッケージング**
- より深い Gemini 連携が必要なときに使える **オプションの MCP / ツール面**

---

## マジックキーワード

パワーユーザー向けの任意ショートカットです。OMG は通常の CLI コマンドでも十分に使えます。

| キーワード / ショートカット | 効果 | 例 |
| --------------------------- | ---- | -- |
| `/tmux` または `$tmux` | tmux チームバックエンドを強制 | `omg team run --task "/tmux smoke"` |
| `/subagents` または `/agents` | subagents バックエンドを強制 | `omg team run --task "/subagents $planner /verify release dry run" --workers 2` |
| `$planner` または `$plan` | subagents タスクの開始時に planner ロールを割り当て | `omg team run --task "$planner draft the implementation plan" --workers 1` |
| `/review` | code-reviewer ロールにマップ | `omg team run --task "/subagents /review inspect auth changes" --workers 1` |
| `/verify` | verifier ロールにマップ | `omg team run --task "/subagents /verify confirm the gate passes" --workers 1` |
| `/handoff` | 引き継ぎ成果物のための writer ロールにマップ | `omg team run --task "/subagents /handoff summarize the release state" --workers 1` |
| `--madmax` | Gemini 起動時の対話引数を `--yolo --sandbox=none` に拡張 | `omg --madmax` |

---

## CLI リファレンス

| コマンド | 内容 | 例 |
| -------- | ---- | -- |
| `omg` | OMG 拡張を読み込んだ Gemini CLI を対話的に起動 | `omg` |
| `omg launch` | デフォルト対話起動コマンドの明示版 | `omg launch --yolo` |
| `omg team run` | 新しいオーケストレーションチーム実行を開始 | `omg team run --task "smoke" --workers 3` |
| `omg team status` | 永続化されたフェーズ、ワーカー、タスク状態を確認 | `omg team status --team oh-my-gemini --json` |
| `omg team resume` | 永続化メタデータから以前の実行を再開 | `omg team resume --team oh-my-gemini --max-fix-loop 1` |
| `omg team shutdown` | 永続化されたランタイムハンドルを正常停止 | `omg team shutdown --team oh-my-gemini --force` |
| `omg team cancel` | アクティブタスクを cancelled にし、ライフサイクル進行を停止 | `omg team cancel --team oh-my-gemini --force --json` |
| `omg doctor` | ローカル前提条件を診断し、安全な問題を自動修正可能 | `omg doctor --fix --json` |
| `omg verify` | 検証スイートまたは階層化された検証プランを実行 | `omg verify --tier thorough` |
| `omg hud` | ライブのチーム HUD を描画、または継続監視 | `omg hud --watch --interval-ms 1000` |
| `omg skill` | 再利用可能なスキルプロンプトを一覧表示または出力 | `omg skill list` |

詳細なコマンド文書: [`docs/omg/commands.md`](docs/omg/commands.md)

---

## 要件

### 必須

- **Node.js 20+**
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)**
- **[tmux](https://github.com/tmux/tmux)**

簡易チェック:

```bash
node -v
gemini --version
tmux -V
```

### tmux インストールのヒント

| プラットフォーム | インストール |
| --------------- | ------------ |
| macOS | `brew install tmux` |
| Ubuntu / Debian | `sudo apt install tmux` |
| Fedora | `sudo dnf install tmux` |
| Arch | `sudo pacman -S tmux` |
| Windows (WSL2) | `sudo apt install tmux` |

### 任意

- 分離された smoke チェック、サンドボックス実験、一部のコントリビューターワークフロー向けの **Docker または Podman**

通常のインストール、対話利用、標準的なチームオーケストレーションに Docker は **必須ではありません**。

---

## ライセンス

MIT

---

<div align="center">

**姉妹プロジェクト:** [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) • [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)

**Gemini ネイティブなオーケストレーション。余計な儀式は最小限。**

</div>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jjongguet/oh-my-gemini&type=date&legend=top-left)](https://www.star-history.com/#jjongguet/oh-my-gemini&type=date&legend=top-left)

## 💖 このプロジェクトを支援する

oh-my-gemini が Gemini CLI ワークフローの改善に役立ったなら、スポンサーをご検討ください。

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge&logo=github)](https://github.com/sponsors/jjongguet)

### スポンサーになる理由

- Gemini 優先オーケストレーション開発を継続できます
- チームランタイム、HUD、検証ワークフローの磨き込みを支援できます
- オープンソースの文書、スキル、運用ツールの維持に役立ちます
- OMG / OMC / OMX エコシステムを支援できます

### その他の支援方法

- ⭐ リポジトリに Star を付ける
- 🐛 バグを報告する
- 💡 機能を提案する
- 📝 コードやドキュメントに貢献する
