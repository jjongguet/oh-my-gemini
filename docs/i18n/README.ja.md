[English](README.md) | [Korean](README.ko.md) | [Chinese](README.zh.md) | **Japanese**

<p align="center">
  <img src="docs/assets/omp_logo.png" alt="oh-my-product" width="240" />
</p>

# oh-my-product

[![npm version](https://img.shields.io/npm/v/oh-my-product?color=cb3837)](https://www.npmjs.com/package/oh-my-product)
[![GitHub stars](https://img.shields.io/github/stars/jjongguet/oh-my-product?style=flat&color=yellow)](https://github.com/jjongguet/oh-my-product/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=flat&logo=github)](https://github.com/sponsors/jjongguet)

> **姉妹プロジェクト:** Claude Code や Codex を使いたいですか？ [oh-my-claudecode (OMC)](https://github.com/Yeachan-Heo/oh-my-claudecode) と [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex) もご覧ください。

**Gemini CLI のためのマルチエージェントオーケストレーション。学習コストはゼロ。**

_Gemini CLI を扱いにくく感じる必要はありません。OMP を実行するだけです。_

[クイックスタート](#クイックスタート) • [チームモード](#チームモード推奨) • [機能](#機能) • [CLI リファレンス](#cli-リファレンス) • [要件](#要件)

---

## クイックスタート

**ステップ 1: インストール**

```bash
npm install -g oh-my-product
```

**ステップ 2: セットアップ**

```bash
omp setup --scope project
```

`omp setup` は、現在のインストールに対して oh-my-product 拡張も自動登録します。

**ステップ 3: Gemini を起動**

```bash
omp
```

以上です。

`omp` は OMP 拡張を読み込んだ状態で Gemini CLI を起動します。すでに tmux の中にいる場合はそのまま実行され、そうでない場合は OMP が新しい tmux セッションを開始します。

### 次に試すとよいコマンド

```bash
omp doctor
omp verify
omp hud --watch
```

---

## インストール

### npm 経由 (CLI + Extension)

```bash
npm install -g oh-my-product
omp setup --scope project
```

`omp setup` はローカル設定ファイルを適用し、oh-my-product を Gemini CLI 拡張として自動登録します。

### Gemini Extension 経由 (拡張のみ)

```bash
gemini extensions install github:jjongguet/oh-my-product
```

この方法では拡張のみを直接インストールします。`omp team run`、`omp doctor`、`omp verify` などの完全な CLI 機能を使う場合は、npm パッケージもグローバルにインストールしてください。

---

## チームモード（推奨）

OMP は tmux ファーストです。`omp team run` は実際の Gemini ワーカーセッションを協調実行し、状態を `.omp/state/` に永続化し、長時間実行タスク向けのライフサイクルコマンドを提供します。

```bash
# 並列実装またはレビュー
omp team run --task "review src/team and src/cli for reliability gaps" --workers 4

# タスク接頭辞キーワードでバックエンド/ロールのルーティングを明示
omp team run --task "/subagents $planner /review /verify ship the release checklist" --workers 3

# 既存実行の確認または再開
omp team status --team oh-my-product --json
omp team resume --team oh-my-product --max-fix-loop 1

# 完了したらきれいに停止
omp team shutdown --team oh-my-product --force
```

**デフォルトバックエンド:** `tmux`  
**任意バックエンド:** 明示的なロール付き実行向けの `subagents`

---

## Why oh-my-product?

- **Gemini ネイティブなワークフロー** - Gemini を二次的なプロバイダーとして後付けするのではなく、Gemini CLI を中心に設計
- **学習コストゼロの入口** - `omp` で対話セッションを起動。覚えるべき拡張の配線は不要
- **チームファーストのオーケストレーション** - 永続ライフサイクル状態と再開可能な実行を備えた協調ワーカー実行
- **検証ゲート付きのデリバリー** - `omp verify` が typecheck・smoke・integration・reliability の各スイートをまとめて実行
- **運用上の可観測性** - HUD、doctor、状態付きライフサイクルコマンドにより実行を監視・復旧しやすい
- **スキル対応ランタイム** - `deep-interview`、`review`、`verify`、`handoff` などの再利用可能なスキルを CLI と extension-first フローの両方で利用可能
- **OMC / OMX ファミリーの一員** - OMC（Claude Code）と OMX（Codex）の Gemini 版として、Gemini ファーストのワークフローに適応

---

## 機能

### オーケストレーションモード

| 機能 | 内容 | 主な用途 |
| ------- | ---------- | ---------- |
| **Team** | 永続状態、ヘルスチェック、resume/shutdown/cancel 制御、tmux をデフォルトランタイムとして備えたマルチワーカーオーケストレーション | 並列実装、レビュー、長時間実行の協調タスク |
| **Interactive Launch** | `omp` / `omp launch` が、現在の tmux ペインまたは新しい tmux セッションで OMP 拡張付き Gemini CLI を起動 | 日常的な対話型 Gemini 開発 |
| **Verify** | `omp verify` が `typecheck`、`smoke`、`integration`、`reliability` にまたがる検証ティアを実行 | リリース確認、信頼性ゲート、CI 向け検証 |
| **HUD** | `omp hud` が永続化されたチーム状態からライブステータスオーバーレイを描画 | JSON 状態ファイルを直接追わずに実行状況を監視 |
| **Skills** | `omp skill` が `deep-interview`、`review`、`verify`、`cancel`、`handoff` などの再利用可能なプロンプトを提供 | 定型ワークフロー、ガイド付き実行、運用引き継ぎ |

### さらに得られる開発者向け利点

- **Doctor コマンド** - Node、Gemini CLI、tmux、拡張アセット、`.omp/state` の書き込み可否を確認
- **決定論的な状態永続化** - 再開可能なオーケストレーションのために `.omp/state` 配下へ保存
- パッケージルートから提供される **Gemini ネイティブ拡張パッケージング** と `/omp:*` コマンド名前空間
- **任意の MCP / ツール連携面** - 必要に応じてより深い Gemini 連携を実現

---

## Magic Keywords

パワーユーザー向けの任意ショートカットです。OMP は通常の CLI コマンドでも十分に使えます。

| キーワード / ショートカット | 効果 | 例 |
| ------------------ | ------ | ------- |
| `/tmux` or `$tmux` | tmux チームバックエンドを強制 | `omp team run --task "/tmux smoke"` |
| `/subagents` or `/agents` | subagents バックエンドを強制 | `omp team run --task "/subagents $planner /verify release dry run" --workers 2` |
| `$planner` or `$plan` | subagents タスク開始時に planner ロールを割り当て | `omp team run --task "$planner draft the implementation plan" --workers 1` |
| `/review` | code-reviewer ロールへマッピング | `omp team run --task "/subagents /review inspect auth changes" --workers 1` |
| `/verify` | verifier ロールへマッピング | `omp team run --task "/subagents /verify confirm the gate passes" --workers 1` |
| `/handoff` | handoff 成果物用の writer ロールへマッピング | `omp team run --task "/subagents /handoff summarize the release state" --workers 1` |
| `--madmax` | Gemini 起動時に `--yolo --sandbox=none` へ展開 | `omp --madmax` |

---

## CLI リファレンス

| コマンド | 内容 | 例 |
| ------- | ------------ | ------- |
| `omp` | OMP 拡張を読み込んだ Gemini CLI を対話的に起動 | `omp` |
| `omp launch` | デフォルトの対話起動コマンドの明示版 | `omp launch --yolo` |
| `omp team run` | 新しいオーケストレーション済みチーム実行を開始 | `omp team run --task "smoke" --workers 3` |
| `omp team status` | 永続化された phase・worker・task のヘルスを確認 | `omp team status --team oh-my-product --json` |
| `omp team resume` | 永続化されたメタデータから以前の実行を再開 | `omp team resume --team oh-my-product --max-fix-loop 1` |
| `omp team shutdown` | 永続 runtime handle を正常終了 | `omp team shutdown --team oh-my-product --force` |
| `omp team cancel` | アクティブタスクをキャンセル済みにし、以後の進行を停止 | `omp team cancel --team oh-my-product --force --json` |
| `omp doctor` | ローカル前提条件を診断し、安全な問題は自動修正 | `omp doctor --fix --json` |
| `omp verify` | 検証スイートまたはティア別検証プランを実行 | `omp verify --tier thorough` |
| `omp hud` | ライブチーム HUD を描画、または継続監視 | `omp hud --watch --interval-ms 1000` |
| `omp skill` | 再利用可能なスキルプロンプトを一覧表示または出力 | `omp skill list` |

詳細なコマンド資料: [`docs/omp/commands.md`](docs/omp/commands.md)

---

## 要件

### 必須

- **Node.js 20+**
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)**
- **[tmux](https://github.com/tmux/tmux)**

クイックチェック:

```bash
node -v
gemini --version
tmux -V
```

### tmux インストールのヒント

| Platform | Install |
| -------- | ------- |
| macOS | `brew install tmux` |
| Ubuntu / Debian | `sudo apt install tmux` |
| Fedora | `sudo dnf install tmux` |
| Arch | `sudo pacman -S tmux` |
| Windows (WSL2) | `sudo apt install tmux` |

### 任意

- **Docker または Podman** - 分離された smoke チェック、sandbox 実験、一部のコントリビューターワークフロー向け

OMP は通常のインストール、対話利用、標準的なチームオーケストレーションに Docker を**必須**とはしません。

---

## ライセンス

MIT

---

<div align="center">

**姉妹プロジェクト:** [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) • [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)

**Gemini ネイティブオーケストレーション。余計な儀式は最小限。**

</div>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jjongguet/oh-my-product&type=date&legend=top-left)](https://www.star-history.com/#jjongguet/oh-my-product&type=date&legend=top-left)

## 💖 このプロジェクトを支援する

oh-my-product が Gemini CLI ワークフローを改善したなら、プロジェクトのスポンサーをご検討ください。

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge&logo=github)](https://github.com/sponsors/jjongguet)

### スポンサーする理由

- Gemini ファーストのオーケストレーション開発を継続するため
- チームランタイム、HUD、検証ワークフローの磨き込みを支援するため
- オープンソースのドキュメント、スキル、運用ツールの維持を助けるため
- OMP / OMC / OMX エコシステムを支援するため

### そのほかの支援方法

- ⭐ リポジトリに Star を付ける
- 🐛 バグを報告する
- 💡 機能を提案する
- 📝 コードまたはドキュメントに貢献する
