# Kitty Graphics Protocol 実験 - 引き継ぎ資料

## 実験の背景

mitchellh が libghostty で Kitty Graphics Protocol を完全公開したことを受け、現在の half-block (`▀▄█`) + ANSI 24bit color によるスプライト描画を、Kitty Graphics Protocol によるネイティブ画像描画に置き換えられるか検証した。

## 確認された事実

| 項目 | 結果 | 備考 |
|---|---|---|
| Ghostty での Kitty Graphics 動作 | OK | Node.js の stdout からも動作 |
| stdout 経由 (Ink パイプライン通過) | NG | Ink が APC エスケープを消す |
| `/dev/tty` 直接書き込みによるバイパス | **OK** | 画像がレンダリングされた |
| カーソル位置制御 (DECSC/DECRC + CUP) | OK | 絶対座標で配置可能 |
| パレットインデックス → RGBA 変換 | OK | pack.json から直接変換 |
| ニアレストネイバー 8x アップスケール | OK | 画質改善に有効 |
| チャンク転送 (m=0/1) | OK | 大きいペイロードの分割送信 |
| アスペクト比補正 (cellRows / 2) | OK | ターミナルセルの縦長比を補正 |

## 未解決の課題

### 1. statusLine のスペース確保 (最大の障壁)

Kitty Graphics の画像は CSS `position: absolute` のように振る舞い、テキストフローに参加しない。stdout 側で画像分の縦スペースを確保する必要があるが、Claude Code のパイプラインが空行を除去する:

```
stdout.trim().split('\n').flatMap(w => w.trim() || []).join('\n')
```

- 空白行 (`' '`) → `trim()` で空文字 → `|| []` で除去
- ノーブレークスペース (`\u00a0`) → 試したが効かなかった（原因未特定）
- half-block 文字を含む行はスペーサーとして機能するが、画像と二重表示になる

**候補アプローチ:**
- `\u00a0` が効かない原因を深掘り（`cli-truncate` や Ink 側の別の処理が除去？）
- 不可視だが幅を持つ Unicode 文字を探す（例: `\u2800` Braille Pattern Blank）
- 既存の half-block 出力はそのまま残し、Kitty 画像をオーバーレイ（二重表示を許容）
- Claude Code 本体に statusLine の raw escape passthrough を要望

### 2. 画像の位置ずれ

`/dev/tty` への書き込みはターミナルの絶対座標を使用するが、Claude Code の statusLine エリアの正確な座標は不明。`stty size` でターミナル行数を取得し `rows - cellRows + 1` で計算しているが、Claude Code の UI レイアウト（入力欄、ステータスバー等）の高さは可変。

### 3. アニメーション非対応

現在の PoC は `idle_1` 固定。状態に応じたスプライト切り替えとアニメーション（フレーム周期ベース）は未実装。

### 4. Kitty 非対応ターミナルのフォールバック

Kitty Graphics Protocol は Ghostty/Kitty/WezTerm のみ。非対応ターミナルでは既存の half-block レンダラーにフォールバックする仕組みが必要。

## 最終動作コード (PoC)

以下は `dist/cli/render-status-line.js` を差し替えた実験コード。キャッシュの dist ファイルを直接編集して検証した。

```javascript
#!/usr/bin/env node
import { renderStatusLine } from "../lib/renderer.js";
import { readStdin } from "./io.js";

async function main() {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const output = await renderStatusLine(input);

    // --- Kitty Graphics Protocol rendering via /dev/tty bypass ---
    const fs = await import('node:fs');
    const { execSync } = await import('node:child_process');
    try {
        const packPath = new URL('../../packs/pixel-buddy/pack.json', import.meta.url);
        const packData = JSON.parse(fs.readFileSync(packPath, 'utf8'));
        const compactData = packData.compact || packData;
        const palette = packData.sprite.palette;
        const spriteName = 'idle_1';
        const sprite = compactData.sprites[spriteName];

        if (sprite) {
            const sw = sprite[0].length;
            const sh = sprite.length;

            // Nearest-neighbor 8x upscale for crisp pixel art
            const scale = 8;
            const uw = sw * scale;
            const uh = sh * scale;
            const rgba = Buffer.alloc(uw * uh * 4);
            for (let y = 0; y < uh; y++) {
                for (let x = 0; x < uw; x++) {
                    const srcX = Math.floor(x / scale);
                    const srcY = Math.floor(y / scale);
                    const idx = (y * uw + x) * 4;
                    const palIdx = sprite[srcY][srcX] || 0;
                    const color = palette[palIdx];
                    if (!color) {
                        rgba[idx] = 0; rgba[idx+1] = 0; rgba[idx+2] = 0; rgba[idx+3] = 0;
                    } else {
                        rgba[idx] = parseInt(color.slice(1,3), 16);
                        rgba[idx+1] = parseInt(color.slice(3,5), 16);
                        rgba[idx+2] = parseInt(color.slice(5,7), 16);
                        rgba[idx+3] = 255;
                    }
                }
            }

            const payload = rgba.toString('base64');
            const cellCols = 16;
            const cellRows = Math.max(1, Math.round(sh / sw * cellCols / 2));

            // Chunked transfer (TTY buffer limit ~4096 bytes per chunk)
            const CHUNK_SIZE = 4096;
            const chunks = [];
            for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
                chunks.push(payload.slice(i, i + CHUNK_SIZE));
            }
            let kittyImg = '';
            for (let i = 0; i < chunks.length; i++) {
                const isFirst = i === 0;
                const isLast = i === chunks.length - 1;
                const m = isLast ? 0 : 1;
                if (isFirst) {
                    kittyImg += `\x1b_Ga=T,f=32,s=${uw},v=${uh},c=${cellCols},r=${cellRows},m=${m};${chunks[i]}\x1b\\`;
                } else {
                    kittyImg += `\x1b_Gm=${m};${chunks[i]}\x1b\\`;
                }
            }

            // Absolute positioning via /dev/tty (bypasses Ink pipeline)
            let rows = 24;
            try {
                const sizeStr = execSync("stty size < /dev/tty 2>/dev/null",
                    { shell: true, encoding: 'utf8' }).trim();
                rows = parseInt(sizeStr.split(' ')[0]) || 24;
            } catch {}

            const deleteAll = '\x1b_Ga=d;\x1b\\';  // Clear previous images
            const saveCursor = '\x1b7';              // DECSC
            const restoreCursor = '\x1b8';           // DECRC
            const moveTo = `\x1b[${rows - cellRows + 1};1H`;

            const ttyFd = fs.openSync('/dev/tty', 'w');
            fs.writeSync(ttyFd, deleteAll + saveCursor + moveTo + kittyImg + restoreCursor);
            fs.closeSync(ttyFd);
        }
    } catch (e) {
        // Silently fall back to half-block rendering
    }

    // stdout: normal half-block output (Kitty image overlays on top)
    process.stdout.write(output);
}

main().catch((error) => {
    if (process.env.CLAUDE_MASCOT_DEBUG === "1") {
        console.error(error);
    }
    process.stdout.write("[-_-] mascot unavailable");
});
```

## 実験の時系列

| Phase | 内容 | 結果 |
|---|---|---|
| 0 | バックアップ作成 | OK |
| 1 | Ghostty 単体テスト (node stdout) | ツール経由では判定不能 |
| 2 | stdout に APC 注入 | `[KGP]` テキストは表示、画像は非表示 → **Ink が APC を消している** |
| 2c | `/dev/tty` 直接書き込み | **画像表示成功** (プロンプトエリア付近) |
| 2d | カーソル位置制御追加 | **ステータスライン付近に画像配置成功** |
| 3 | pack.json からスプライト読み込み→RGBA変換 | **猫スプライト表示成功** (アスペクト比要修正) |
| 3b | アスペクト比補正 (cellRows/2) | **OK** (サイズ小さい、画質荒い) |
| 3c | 8x ニアレストネイバーアップスケール + チャンク転送 | **画質・サイズ改善** |
| 3d | compact スプライト (顔版) | **OK** |
| 4 | half-block 除去 + スペーサー確保 | **NG** (Claude Code パイプラインが空行除去) |

## Kitty Graphics Protocol 技術メモ

### APC エスケープ構文

```
\x1b_G<key=value,...>;<base64_payload>\x1b\\
```

### 主要パラメータ

| Key | 意味 | 値例 |
|---|---|---|
| `a` | アクション | `T` (transmit), `d` (delete), `f` (frame), `a` (animate) |
| `f` | フォーマット | `32` (RGBA), `24` (RGB), `100` (PNG) |
| `s` | 幅 (ピクセル) | `128` |
| `v` | 高さ (ピクセル) | `96` |
| `c` | 表示幅 (セル) | `16` |
| `r` | 表示高さ (セル) | `6` |
| `m` | チャンク継続 | `1` (続きあり), `0` (最終) |
| `i` | 画像ID | キャッシュ用 |
| `t` | 転送方式 | `d` (direct), `f` (file), `s` (shared memory) |

### GIF アニメーション対応 (未検証)

Kitty Protocol はフレームベースアニメーションをサポート:
- `a=f` でフレーム定義 (フレーム番号、間隔、ブレンドモード)
- `a=a` でアニメーション制御 (開始・停止)
- 任意の画像を送信可能 (`f=100` で PNG 直接送信も可)

### ansi-regex の非対応

`ansi-regex` v6 は APC (`\x1b_...\x1b\\`) をマッチしない。OSC (`\x1b]`) と CSI (`\x1b[`) のみ対応。そのため:
- `strip-ansi` は APC を除去しない
- `string-width` は APC ペイロードを表示幅としてカウント (幻の幅が加算される)

## 関連リンク

- mitchellh のポスト: https://x.com/mitchellh/status/2041253090205249584
- Ghostling PR: https://github.com/ghostty-org/ghostling/pull/13
- Kitty Graphics Protocol 仕様: https://sw.kovidgoyal.net/kitty/graphics-protocol/
