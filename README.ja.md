# Claude Code Mascot

Claude Code のステータスラインに住むピクセルアートのマスコットプラグインです。

[English](README.md)

![Claude Code Mascot スクリーンショット](docs/screenshot.png)
![Claude Code Mascot 成功時](docs/screenshot-success.png)

## コンセプト

Claude Code によって開発の効率は飛躍的に上がりました。でもその分、脳への負荷も上がっています。開発の合間に、ちょっとした癒やしが必要です。

このマスコットは作業中にツールが実行されるたびに表情を変えます。コンテキストウィンドウが切迫すると顔を真っ赤にして焦ります。自分で好きなキャラクターを設定することもできます（まだ十分に試せていないのでベータ版だと思ってください！）。

作業に追われるようになおさらなってきているエンジニアたちに、ちょっとした癒やしを。

## 特徴

- **ピクセルアートのマスコット** をターミナルに直接レンダリング（ASCIIアートではありません）
- **9つのセッション状態に反応**: idle、thinking、tool running、tool success、tool failure、permission、subagent running、done、auth success
- **ヒートマップカラー変化**: コンテキストウィンドウの使用率が上がると、マスコットの毛色が赤に変化
- **ステータスサマリー表示**: gitブランチ、モデル名、ツール数、コンテキスト%、API使用量
- **カスタムマスコットパック**: 自分だけのキャラクターを作って共有可能

## クイックスタート

### Claude Code Plugin Marketplace 経由（推奨）

```
/plugin marketplace add TeXmeijin/claude-code-mascot
/plugin install claude-code-mascot
```

セットアップスキルを実行して、ステータスラインとフックを設定します:

```
/claude-mascot:setup
```

### 手動インストール

```bash
git clone https://github.com/TeXmeijin/claude-code-mascot.git
cd claude-code-mascot
npm install && npm run build
node dist/cli/setup-helper.js --write
```

`statusLine` が既に設定されている場合は `--force` を追加してください。フックエントリは既存のフックを削除せずにマージされます。

## カスタムパック

マスコットは完全に差し替え可能です。自分だけのキャラクターパックを作成して使用できます。

### パック検索順序

1. **プロジェクトローカル**: `<project>/.claude/mascot-packs/<pack-name>/`
2. **ユーザーグローバル**: `~/.claude/plugins/claude-code-mascot/packs/<pack-name>/`
3. **バンドル**: `packs/<pack-name>/`（プラグイン同梱）

### カスタムパックの作成手順

1. `examples/external-pack/pack.yaml` をテンプレートとしてコピー
2. `~/.claude/plugins/claude-code-mascot/packs/<パック名>/pack.json`（または `pack.yaml`）として配置
3. `~/.claude/plugins/claude-code-mascot/config.json` でパック名を設定:

```json
{
  "pack": "パック名"
}
```

4. パックを検証:

```bash
claude-mascot-validate-pack ~/.claude/plugins/claude-code-mascot/packs/パック名
```

5. プレビュー:

```bash
claude-mascot-storybook --pack パック名
```

パック仕様の詳細は [docs/pack-spec.md](docs/pack-spec.md) を参照してください。

## 設定

### 設定ファイル

- **ユーザー設定**: `~/.claude/plugins/claude-code-mascot/config.json`
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

```bash
# 全状態のストーリーブック形式ギャラリー
claude-mascot-storybook --pack pixel-buddy

# 特定の状態をプレビュー
claude-mascot-preview-pack --pack pixel-buddy --state thinking --frames 3 --color always

# パックを検証
claude-mascot-validate-pack ./packs/pixel-buddy

# レンダープロファイルを比較
claude-mascot-statusline-lab --pack pixel-buddy --profiles auto,claude-code-safe

# ステータスラインを手動レンダリング
printf '{"session_id":"demo","workspace":{"project_dir":"%s","current_dir":"%s"}}' "$PWD" "$PWD" | claude-mascot-statusline
```

## 開発

```bash
git clone https://github.com/TeXmeijin/claude-code-mascot.git
cd claude-code-mascot
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## アンインストール

1. `~/.claude/settings.json` から `statusLine` エントリを削除または置換
2. `~/.claude/settings.json` からマスコットフックエントリを削除
3. 必要に応じて `~/.claude/plugins/claude-code-mascot/` を削除（キャッシュされた状態とユーザーパックのクリア）

## ライセンス

[MIT](LICENSE)
