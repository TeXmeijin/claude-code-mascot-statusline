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
/claude-code-mascot-statusline:setup
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

## 技術詳細: ナローターミナル対応

Claude Code内部のstatusLineレンダラーはInkの`<Text wrap="truncate">`を使用しており、内部で`cli-truncate`が複数行テキスト全体を1つの文字列として処理します。**いずれかの行**がstatusLineコンテナの利用可能幅を超えると、その行以降の全行が無言で削除され、マスコットスプライトの上部（典型的には耳だけ）しか表示されなくなります。

これはClaude Code側の既知の挙動で、複数のオープンissueで報告されています:

- [anthropics/claude-code#28750](https://github.com/anthropics/claude-code/issues/28750) — ナロー端末で複数行statusLineの2行目が消える（内部の`wrap: "truncate"`が[コメント](https://github.com/anthropics/claude-code/issues/28750#issuecomment-3962324753)で特定）
- [anthropics/claude-code#27305](https://github.com/anthropics/claude-code/issues/27305) — 通知バナー表示時にstatusLineが圧縮される（`flexShrink: 1`）
- [anthropics/claude-code#27864](https://github.com/anthropics/claude-code/issues/27864) — cli.jsから抽出されたフッターレイアウト構造（`isNarrow`によるrow/column切り替え）
- [anthropics/claude-code#22115](https://github.com/anthropics/claude-code/issues/22115) — ターミナル幅がstatusLineコマンドに渡されない

トリガーはほぼ常に**サマリーテキスト行**（ステート、プロジェクト名、ブランチ、モデル名、使用率を`|`で結合）で、80文字を超えやすいです。スプライト行自体はhalf-blockモードで16文字幅に収まっています。

### プラグイン側の対策

1. **動的ターミナル幅検出** — statusLineコマンドはパイプされた子プロセスとして実行されるため`process.stdout.columns`は`undefined`になります。そこで親プロセスのTTYデバイスを`ps`コマンドで特定し、`stty size`で実際のターミナルサイズを取得しています。結果は5秒TTLでキャッシュされます。

2. **サマリー行の自動折り返し** — サマリーテキストを`|`区切りで分割し、各行が`terminal_cols - 10`文字以内に収まるように再構成します。これにより全行がコンテナ幅以内に収まり、`cli-truncate`の発動を防ぎます。

3. **サマリー項目のカスタマイズ** — ユーザーはconfigの`summaryItems`で表示項目を選択できます:

   ```json
   {
     "summaryItems": ["project", "branch", "context", "usage5h"]
   }
   ```

   利用可能なキー: `project`, `branch`, `model`, `tools`, `failures`, `subagents`, `context`, `usage5h`, `usage7d`

これらの対策はClaude Code v2.1.76のバンドルバイナリの解析（2026-03-15時点）に基づいています。内部レイアウトはstatusLineを`flexShrink: 1`のflexコンテナに配置し、フッターは幅80以上で`row`レイアウト（statusLineは約半分の幅）、80未満で`column`レイアウト（全幅）に切り替わります。親プロセスTTY方式は[ccstatusline](https://github.com/sirmalloc/ccstatusline)や[claude-powerline](https://github.com/Owloops/claude-powerline)でも採用されています。

## Good Bye

Claude Code 内でアンインストールコマンドを実行してください:

```
/claude-code-mascot-statusline:uninstall
```

`statusLine` エントリ、すべてのマスコットフックエントリ、およびランタイムデータディレクトリが削除されます。完了後、Claude Code を再起動してください。

## ライセンス

[MIT](LICENSE)
