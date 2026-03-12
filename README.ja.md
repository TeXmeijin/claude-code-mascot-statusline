# Claude Code Mascot

Claude Code のステータスラインに住むピクセルアートのマスコットプラグインです。

[English](README.md)

![Claude Code Mascot スクリーンショット](docs/screenshot.png)
![Claude Code Mascot 成功時](docs/screenshot-success.png)
![Claude Code Mascot デモ](docs/demo.gif)

## コンセプト

Claude Code によって開発の効率は飛躍的に上がりました。でもその分、脳への負荷も上がっています。開発の合間に、ちょっとした癒やしが必要です。

このマスコットは作業中にツールが実行されるたびに表情を変えます。コンテキストウィンドウが切迫すると顔を真っ赤にして焦ります。自分で好きなキャラクターを設定することもできます（まだ十分に試せていないのでベータ版だと思ってください！）。

作業に追われるようになおさらなってきているエンジニアたちに、ちょっとした癒やしを。

## この子の個性

- **ピクセルアートのマスコット** をターミナルに直接レンダリング（ASCIIアートではありません）
- **9つのセッション状態に反応**: idle、thinking、tool running、tool success、tool failure、permission、subagent running、done、auth success
- **ヒートマップカラー変化**: コンテキストウィンドウの使用率が上がると、マスコットの毛色が赤に変化
- **ステータスサマリー表示**: gitブランチ、モデル名、ツール数、コンテキスト%、API使用量
- **カスタムマスコットパック**: 自分だけのキャラクターを作って共有可能

## しくみ

マスコットは Claude Code の [フックシステム](https://docs.anthropic.com/en/docs/claude-code/hooks) を通じてセッション状態を検出します。各フックイベント（ツール開始、ツール成功、パーミッション要求など）がマスコットの内部状態を更新し、ステータスラインが対応する表情をレンダリングします。

この仕組みは継続的なポーリングではなくイベント駆動のため、表示される状態が必ずしもセッションのリアルタイムな状況を正確に反映するとは限りません。たとえば、フックのタイミングによっては状態遷移にわずかな遅延が生じたり、遷移が反映されないことがあります。正確なステータスモニターというよりは、イベントに反応するお供だと思ってください。

## この子と暮らし始める

### Claude Code Plugin Marketplace 経由（推奨）

```
/plugin marketplace add TeXmeijin/claude-code-mascot-statusline
/plugin install claude-code-mascot-statusline
```

セットアップスキルを実行して、ステータスラインとフックを設定します:

```
/claude-mascot:setup
```

### 手動インストール

```bash
git clone https://github.com/TeXmeijin/claude-code-mascot-statusline.git
cd claude-code-mascot-statusline
npm install && npm run build
node dist/cli/setup-helper.js --write
```

既存の `statusLine` は自動的に置き換えられます。フックエントリは既存のフックを削除せずにマージされます。

> 2種類目の組み込みパック **space-invader** もあります。プロジェクトやアカウントの使い分けに便利です。
>
> ![Space Invader パック](docs/screenshot-space-invader.png)

## あなただけのお供をつくる

マスコットは完全に差し替え可能です。自分だけのキャラクターパックを作成して使用できます。

### パック検索順序

1. **プロジェクトローカル**: `<project>/.claude/mascot-packs/<pack-name>/`
2. **ユーザーグローバル**: `~/.claude/plugins/claude-code-mascot-statusline/packs/<pack-name>/`
3. **バンドル**: `packs/<pack-name>/`（プラグイン同梱）

### カスタムパックの作成手順

1. `examples/external-pack/pack.yaml` をテンプレートとしてコピー
2. `~/.claude/plugins/claude-code-mascot-statusline/packs/<パック名>/pack.json`（または `pack.yaml`）として配置
3. `~/.claude/plugins/claude-code-mascot-statusline/config.json` でパック名を設定:

```json
{
  "pack": "パック名"
}
```

4. パックを検証:

```bash
node dist/cli/validate-pack.js ~/.claude/plugins/claude-code-mascot-statusline/packs/パック名
```

5. プレビュー:

```bash
node dist/cli/storybook.js --pack パック名
```

パック仕様の詳細は [docs/pack-spec.md](docs/pack-spec.md) を参照してください。

> **ヒント:** Claude Code の `/create-mascot-pack` スキルを使えば、対話的にパックを作成・編集できます。

## 設定

### 設定ファイル

- **ユーザー設定**: `~/.claude/plugins/claude-code-mascot-statusline/config.json`
- **プロジェクト設定**: `.claude/mascot.json`（ユーザー設定を上書き）

```json
{
  "pack": "pixel-buddy",
  "color": "auto",
  "twoLine": true,
  "renderProfile": "claude-code-safe",
  "safeBackground": "#000000"
}
```

### 環境変数

| 変数 | 説明 |
|---|---|
| `CLAUDE_MASCOT_PACK` | アクティブなパック名を上書き |
| `CLAUDE_MASCOT_COLOR` | `never` でカラーを無効化 |
| `CLAUDE_MASCOT_WIDTH_HINT` | ナローモード用の幅ヒント |
| `NO_COLOR` | 標準のno-colorフラグ（ANSIカラーを無効化） |

### レンダープロファイル

- `claude-code-safe`（デフォルト）: `half-block` レンダリングを維持しつつ、透明セルを背景色のノーブレークスペースとして出力（ホストによるトリミングを防止）
- `auto`: パックが宣言したレンダラーをそのまま使用

## CLIツール

プラグインのルートディレクトリから実行してください:

```bash
# 全状態をストーリーブック形式で一覧表示
node dist/cli/storybook.js --pack pixel-buddy

# 特定の状態をプレビュー
node dist/cli/preview-pack.js --pack pixel-buddy --state thinking --frames 3 --color always

# パックファイルを検証
node dist/cli/validate-pack.js ./packs/pixel-buddy

# レンダープロファイルを並べて比較
node dist/cli/statusline-lab.js --pack pixel-buddy --profiles auto,claude-code-safe

# ステータスラインを手動レンダリング（JSONをstdinに流す）
printf '{"session_id":"demo","workspace":{"project_dir":"%s","current_dir":"%s"}}' "$PWD" "$PWD" \
  | node dist/cli/render-status-line.js

# セットアップ（statusLineとフックをsettings.jsonに書き込む）
node dist/cli/setup-helper.js --write
```

## 開発

```bash
git clone https://github.com/TeXmeijin/claude-code-mascot-statusline.git
cd claude-code-mascot-statusline
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## コントリビュート

- **バグ修正**: 明確なバグを見つけたら、プルリクエストを送ってください。
- **自分だけのマスコット**: カスタムパックを手元で作って使えます。アップストリームに上げる必要はありません。
- **みんなのための新マスコット**: いいものができたら、追加の組み込みパックとしてプルリクエストを出してください！
- **Claude Code でパック作成**: `/create-mascot-pack` スキルを使えば、対話的に新しいパックを作成・編集できます。

## Good Bye

Claude Code 内でアンインストールコマンドを実行してください:

```
/claude-code-mascot-statusline:uninstall
```

`statusLine` エントリ、すべてのマスコットフックエントリ、およびランタイムデータディレクトリが削除されます。完了後、Claude Code を再起動してください。

## ライセンス

[MIT](LICENSE)
