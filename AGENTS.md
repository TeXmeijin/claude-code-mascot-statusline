# AGENTS.md

This repository implements a Claude Code plugin that renders a pixel-art mascot in the Claude Code status line.

## Primary Goal

Keep the mascot visually legible as a terminal sprite while preserving accurate session-state reporting.

The two failure modes to avoid are:

- Regressing sprite packs back into ASCII line art
- Regressing status detection back into `waiting`/`idle` because runtime state is not being observed correctly

## What Matters Here

- The mascot is defined as sprite data, not display strings.
- Status line rendering is a conversion pipeline from sprite grid -> terminal cells.
- Runtime state is best-effort and comes from two sources:
  - Hook-persisted session state
  - Transcript-derived fallback state from `transcript_path`

If those disagree, newer data wins.

## Architecture

- [`src/lib/pack.ts`](src/lib/pack.ts)
  Loads and validates pack manifests. Packs use `specVersion: 2` and define fixed-size palette-index grids.
- [`src/lib/renderer.ts`](src/lib/renderer.ts)
  Converts a sprite frame into terminal output. Supports `bg-space` and `half-block`.
- [`src/lib/transcript.ts`](src/lib/transcript.ts)
  Parses transcript JSONL tails to infer current state when hooks are missing or stale.
- [`src/lib/state-machine.ts`](src/lib/state-machine.ts)
  Maps hook events into abstract mascot states.
- [`src/cli/setup-helper.ts`](src/cli/setup-helper.ts)
  Merges both `statusLine` and mascot hooks into `~/.claude/settings.json`.

## Non-Negotiable Product Rules

- Do not introduce `/`, `\\`, `(`, `)`, `^`, `<`, `>` style ASCII outline art as mascot content.
- Do not store pre-rendered art strings in packs.
- Do not rely on plugin metadata alone to install status line behavior. Claude Code requires settings-level `statusLine`.
- Do not assume hooks are always configured. Transcript fallback must remain functional.
- Do not remove existing user hooks from `settings.json`; merge mascot hooks alongside them.

## Expected Workflow

When making changes:

1. Understand whether the issue is in sprite data, state inference, or Claude setup.
2. Prefer fixing the smallest layer that explains the bug.
3. Keep renderer changes separate from pack-art changes when possible.
4. Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

5. If the bug is runtime-only, validate with:

```bash
node dist/cli/preview-pack.js --pack pixel-buddy --state thinking --frames 3 --color never
node dist/cli/setup-helper.js
```

## Technical Notes

### Why transcript fallback exists

Claude Code plugin metadata cannot reliably install runtime hooks by itself. A user can have `statusLine` configured without mascot hooks. In that case, the renderer still receives `transcript_path`, so transcript parsing is the most robust fallback.

### Why `half-block` is preferred for the default cat

Terminal height is the tightest constraint. `half-block` effectively doubles vertical resolution relative to ordinary character cells, which makes a face-only mascot much more legible at small sizes.

### Why settings merge matters

Users often already have personal hooks. Overwriting the entire `hooks` object would be a destructive regression. The setup helper must append mascot command hooks per event without deleting unrelated hooks.

## When Editing Sprite Packs

- Keep all frames the same width and height.
- Prefer small deltas between states, but make them visible enough to survive terminal blur.
- For cat-face packs, prioritize silhouette, ears, eyes, and muzzle over body detail.
- If animation is too subtle in practice, increase state-to-state contrast instead of adding more palette colors.

## When Editing State Logic

- `tool_running` and `subagent_running` should be visible quickly.
- `tool_success`, `tool_failure`, and `done` need short hold windows; otherwise users never see them.
- `thinking` should decay to `idle` when the transcript has gone stale.
- A broken hook path should not make the mascot useless.

## Files To Read First

- [`README.md`](README.md)
- [`docs/pack-spec.md`](docs/pack-spec.md)
- [`src/lib/renderer.ts`](src/lib/renderer.ts)
- [`src/lib/transcript.ts`](src/lib/transcript.ts)
- [`packs/pixel-buddy/pack.json`](packs/pixel-buddy/pack.json)
