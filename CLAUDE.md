# CLAUDE.md

This repository is a Claude Code mascot plugin. The mascot is rendered in Claude Code's status line as terminal pixel art, not ASCII art.

## Project Summary

The plugin has three responsibilities:

1. Observe Claude Code session activity
2. Convert that activity into abstract mascot states
3. Render a small pixel sprite that reflects the current state

The mascot system is intentionally split so that pack authors draw sprites, while runtime code handles state detection and terminal rendering.

## Core Design

### 1. Sprite-first pack format

Pack files use `specVersion: 2` and define:

- Fixed sprite dimensions
- Palette colors
- Named sprite frames as 2D palette-index arrays
- State-to-frame mappings

This is deliberate. A previous approach allowed rendered text art and produced malformed “cute ASCII” instead of genuine pixel sprites. That direction is out of scope for this project.

Relevant files:

- [`docs/pack-spec.md`](docs/pack-spec.md)
- [`src/lib/pack.ts`](src/lib/pack.ts)
- [`packs/pixel-buddy/pack.json`](packs/pixel-buddy/pack.json)

### 2. Dual-source state detection

Runtime state is derived from two sources:

- Hook-persisted state in `$CLAUDE_CONFIG_DIR/plugins/claude-code-mascot-statusline/state` (default: `~/.claude/plugins/claude-code-mascot-statusline/state`)
- Transcript-derived state from `transcript_path`

Hook state is useful when hooks are installed correctly. Transcript-derived state is more resilient because `statusLine` receives `transcript_path` even when the plugin's hooks were never merged into `settings.json`.

This fallback is critical in real installations.

Relevant files:

- [`src/lib/state-machine.ts`](src/lib/state-machine.ts)
- [`src/lib/state.ts`](src/lib/state.ts)
- [`src/lib/transcript.ts`](src/lib/transcript.ts)
- [`src/lib/renderer.ts`](src/lib/renderer.ts)

### 3. Terminal rendering strategy

The renderer supports:

- `bg-space`
  Uses ANSI background color on spaces. Best when width is available.
- `half-block`
  Uses `▀`, `▄`, `█` plus ANSI foreground/background colors. Best for compact, legible faces.

At runtime, the default render profile is `claude-code-safe`, not raw `auto`. This keeps the visible `half-block` sprite intact, but hardens fully transparent cells with background-colored non-breaking spaces because Claude Code's status line appears to normalize plain whitespace in some cases.

The default cat-face pack uses `half-block` because terminal vertical resolution is limited and face-only sprites need more effective height.

Relevant file:

- [`src/lib/renderer.ts`](src/lib/renderer.ts)

### 4. Hierarchical configuration

Configuration is resolved in priority order: environment variables → project config (`.claude/mascot.json`) → user config (`~/.claude/plugins/claude-code-mascot-statusline/config.json`) → defaults.

| Key | Type | Default | Description |
|---|---|---|---|
| `pack` | string | `"pixel-buddy"` | Active pack name |
| `color` | `"auto"` \| `"always"` \| `"never"` | `"auto"` | Color output mode |
| `twoLine` | boolean | `true` | Two-line layout |
| `renderProfile` | `"auto"` \| `"claude-code-safe"` | `"claude-code-safe"` | Render profile |
| `safeBackground` | hex color | `"#333333"` | Background for safe mode |

Environment variable overrides: `CLAUDE_MASCOT_PACK`, `CLAUDE_MASCOT_COLOR`, `CLAUDE_MASCOT_TWO_LINE`, `CLAUDE_MASCOT_RENDER_PROFILE`, `CLAUDE_MASCOT_SAFE_BACKGROUND`, `CLAUDE_MASCOT_HOME`, `CLAUDE_MASCOT_WIDTH_HINT`, `CLAUDE_MASCOT_FORCE_COLOR`, `CLAUDE_MASCOT_DEBUG`.

Relevant file:

- [`src/lib/config.ts`](src/lib/config.ts)
- [`src/lib/constants.ts`](src/lib/constants.ts)

### 5. API usage display

The status line shows 5-hour and 7-day API usage percentages with reset countdown. Usage data is fetched from `https://api.anthropic.com/api/oauth/usage` using an OAuth token from macOS Keychain or `.credentials.json`. Results are cached with a 6-minute TTL.

Relevant file:

- [`src/lib/usage.ts`](src/lib/usage.ts)

## Claude Code Integration Notes

### Plugin metadata is not enough

Claude Code plugin metadata does not automatically activate `statusLine`. The user must still have `statusLine` configured in `~/.claude/settings.json`.

This repo includes:

- A plugin manifest for installation metadata (`.claude-plugin/plugin.json`)
- A marketplace manifest (`.claude-plugin/marketplace.json`)
- A setup helper that merges both `statusLine` and mascot hooks into user settings
- A slash command (`commands/setup.md`) for `/claude-mascot:setup`

The `dist/` directory is committed to the repo so that marketplace plugin installations work without a build step.

Relevant files:

- [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json)
- [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)
- [`commands/setup.md`](commands/setup.md)
- [`src/cli/setup-helper.ts`](src/cli/setup-helper.ts)

### Hooks must be merged, not replaced

Users commonly already have hooks. This repo must not delete them.

The setup helper appends mascot command hooks for:

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PermissionRequest`
- `PostToolUse`
- `PostToolUseFailure`
- `Notification`
- `SubagentStart`
- `SubagentStop`
- `Stop`
- `SessionEnd`

If the mascot hook is already present for an event, it is not duplicated.

The setup helper accepts `--write` (apply changes) and `--plugin-root` (explicit plugin location). The `--force` flag was removed — existing `statusLine` is now replaced automatically.

### 6. Status line summary

`summarizeState()` in `renderer.ts` builds the text line below/beside the sprite.

Format: `<state> | <project-dir> | ⎇ <branch> | <model> | tools:N | fail:N | sub:N | ctx:N% | 5h:N%(Xm) | 7w:N%(Xh)`

- **Project directory**: Basename of `project_dir`
- **Git branch**: Derived at render time via `git rev-parse --abbrev-ref HEAD` on `project_dir`
- **Model name**: From `input.model.display_name` (fallback: `input.model.id`)
- **Usage text color**: 5h/7d text is colorized with the same heat interpolation (60→85% = gray→red)

### 7. Heat palette

The cat sprite's fur color shifts toward red (`#ff4444`) as context window usage increases.

- Source: **`context_window.used_percentage` only** — 5h/7d usage does NOT affect sprite color (it was removed because high API usage made the cat red even at low context)
- Threshold: 60% (no change below this)
- Max: 85% (fully red at this point)
- Interpolation: linear between 60–85%

Constants in `renderer.ts`: `HEAT_THRESHOLD`, `HEAT_MAX`, `HEAT_TARGET`, `HEAT_PALETTE_INDEX`

## Common Failure Modes

### “The mascot is always waiting”

Likely causes:

- `statusLine` is configured but mascot hooks were never installed
- The active session predates the latest build
- Hook state is stale and transcript fallback is missing or broken

First checks:

```bash
node dist/cli/setup-helper.js
ls ~/.claude/plugins/claude-code-mascot-statusline/state
```

### “The mascot looks like ASCII art”

That is a pack or renderer regression.

Check:

- No pre-rendered text assets were reintroduced
- Pack still uses numeric sprite grids
- Renderer still converts cells to block output

### “The mascot is technically correct but visually weak”

This is usually not a rendering bug. It is a sprite-art problem.

For this repository, visual quality depends heavily on:

- Strong silhouette
- Clear ears and eye placement
- Large enough state deltas
- Low noise in the summary text beneath the sprite

## Development Commands

```bash
pnpm typecheck
pnpm test
pnpm build
```

Useful manual checks:

```bash
node dist/cli/preview-pack.js --pack pixel-buddy --state idle --frames 2 --color never
node dist/cli/preview-pack.js --pack pixel-buddy --state thinking --frames 3 --color always
node dist/cli/validate-pack.js packs/pixel-buddy
node dist/cli/storybook.js --pack pixel-buddy --color always
node dist/cli/statusline-lab.js
node dist/cli/analyze-capture.js <png-file>
```

## Half-block レンダリングでスプライトを編集するときの注意

`half-block` モードでは 2 行が 1 表示行にまとめられる（行ペア: (0,1), (2,3), (4,5), …）。
スプライトのピクセルを変更するときは、**表示結果を行ペア単位で検証**しなければならない。

### 縦方向の衝突に注意

同じ列で隣接する表示行が両方とも暗色の半ブロック（`▀` や `▄`）になると、視覚的に暗い縦線ができて意図しない印象を与える。

例: pixel-buddy の `tool_success` で ^_^ 目のピーク（row 4, col 4 = outline）とヒゲの点（row 6, col 4 = outline）が縦に並び、目とヒゲが繋がって見えた。
→ 対策: 笑顔ではヒゲの点を毛色(2)に変えて縦の暗色連続を断った。

**チェックポイント:**
- 変更した列の上下の表示行も確認する
- idle で白目(4)が暗色の連続を遮断していた場合、閉じ目にすると暗色が直結する可能性がある
- 口のアウトラインを広げると、ヒゲや目のアウトラインと同じ列に乗りやすい

### 表情変更時のベースライン

表情を変えるときは idle のピクセル配置をベースラインとして参照し、**構造（アウトライン位置、ヒゲの列、口の列）を理解してから**変更する。

pixel-buddy の顔の主要構造:
- 目: row 4-5, cols 4/11 に白目、cols 3/12 にアウトライン
- ヒゲ: row 6, cols 3/12 に隙間(0)、cols 4/11 に点(1)
- 口: row 7, cols 6/9 にアウトライン、cols 7-8 にピンク(3)

### ステート間の差分設計

各ステートは idle と明確に区別できる必要がある。ただし変更が多すぎると顔が崩壊する。

- **動きの表現**（tool_running 等）: 脚のポーズ変更 + スピードライン(7) が最も効果的。目は集中顔（細目）にする
- **感情の表現**（tool_success 等）: 目の形変更が主役。口や周囲エフェクトは補助。ヒゲ等の周辺要素は必要に応じて省略してよい
- キラキラ等のエフェクトは顔の外側（四隅、耳の間）に配置し、顔パーツと干渉させない

## Guidance For Future Changes

- If improving visuals, change the pack before changing the renderer.
- If improving accuracy, prefer transcript parsing before adding more hook complexity.
- If changing setup, preserve user configuration.
- If adding new states, update pack spec, loader validation, renderer summaries, and tests together.

## Files Worth Reading Before Editing

- [`README.md`](README.md)
- [`docs/pack-spec.md`](docs/pack-spec.md)
- [`src/lib/pack.ts`](src/lib/pack.ts)
- [`src/lib/renderer.ts`](src/lib/renderer.ts)
- [`src/lib/transcript.ts`](src/lib/transcript.ts)
- [`src/lib/config.ts`](src/lib/config.ts)
- [`src/lib/constants.ts`](src/lib/constants.ts)
- [`src/lib/usage.ts`](src/lib/usage.ts)
- [`src/cli/setup-helper.ts`](src/cli/setup-helper.ts)
- [`commands/setup.md`](commands/setup.md)
