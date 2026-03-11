# Pack Spec v2 Quick Reference

## Required Fields

```yaml
name: my-pack            # lowercase, hyphens OK
specVersion: 2           # must be exactly 2
displayName: My Pack
author: your-name
description: One-line description

sprite:
  width: 16              # all frames must match
  height: 16             # all frames must match
  palette:
    - null               # index 0 = transparent (required)
    - "#4b556a"          # index 1+: hex colors
  renderMode: half-block # or bg-space
  pixelWidth: 2          # horizontal scaling (bg-space only)

sprites:
  idle_1:                # 2D array of palette indices
    - [0, 0, 1, 1, 0, 0]
    - [0, 1, 2, 2, 1, 0]
    # ... height rows, each width columns

states:
  idle: [idle_1, idle_2]
  thinking: [thinking_1]
  # ...

fallbacks:
  unknown: idle_1        # REQUIRED
  narrow: idle_1         # optional (for narrow terminals)

timing:                  # optional, sensible defaults exist
  idleFramePeriodMs: 500
  thinkingFramePeriodMs: 300
  toolRunningFramePeriodMs: 200
  toolSuccessHoldMs: 1000
  toolFailureHoldMs: 1500
  authSuccessHoldMs: 2000
  doneHoldMs: 2000
```

## Validation Rules

- Row count per frame must equal `sprite.height`
- Column count per row must equal `sprite.width`
- Every cell must be an integer in range `[0, palette.length)`
- `palette[0]` must be `null` or `"transparent"`
- Hex colors must match `#[0-9a-fA-F]{6}`
- `fallbacks.unknown` is required

## Prohibited

- ASCII art characters: `/`, `\`, `(`, `)`, `^`, `<`, `>`, face glyphs, kaomoji
- Pre-rendered text strings — every visual element comes from palette-indexed cells

## Render Modes

### half-block (recommended for characters)
- Uses `▀`, `▄`, `█` + ANSI fg/bg colors
- Display height = pixel height / 2 (rows paired: (0,1), (2,3), ...)
- Best for faces and detailed characters

### bg-space
- Uses ANSI background colors on spaces
- Display height = pixel height (1:1)
- `pixelWidth` controls horizontal scaling
- Simpler but less compact

## State Names (all 10)

`idle`, `thinking`, `tool_running`, `tool_success`, `tool_failure`, `question`, `permission`, `subagent_running`, `done`, `auth_success`

Not all states need unique frames — use `fallbacks.unknown` as catch-all.

## Minimal Complete Example (pack.yaml)

```yaml
name: terminal-sprout
specVersion: 2
displayName: Terminal Sprout
author: community-template
description: Small pixel sprout example pack using sprite grids rather than text art.
sprite:
  width: 6
  height: 6
  palette:
    - null
    - "#213547"
    - "#63d2a1"
    - "#c8f169"
    - "#f4c95d"
  renderMode: bg-space
  pixelWidth: 2
sprites:
  idle_1:
    - [0, 0, 2, 2, 0, 0]
    - [0, 2, 3, 3, 2, 0]
    - [0, 0, 1, 1, 0, 0]
    - [0, 1, 4, 4, 1, 0]
    - [1, 4, 4, 4, 4, 1]
    - [0, 1, 0, 0, 1, 0]
  thinking_1:
    - [0, 0, 2, 3, 0, 0]
    - [0, 2, 3, 3, 2, 0]
    - [0, 0, 1, 1, 0, 4]
    - [0, 1, 4, 4, 1, 0]
    - [1, 4, 4, 4, 4, 1]
    - [0, 1, 0, 0, 1, 0]
  done_1:
    - [0, 2, 0, 0, 2, 0]
    - [2, 3, 3, 3, 3, 2]
    - [0, 0, 1, 1, 0, 0]
    - [0, 1, 4, 4, 1, 0]
    - [1, 4, 2, 2, 4, 1]
    - [0, 1, 0, 0, 1, 0]
states:
  idle: [idle_1]
  thinking: [thinking_1]
  done: [done_1]
fallbacks:
  unknown: idle_1
  narrow: idle_1
timing:
  idleFramePeriodMs: 1000
  thinkingFramePeriodMs: 300
  doneHoldMs: 2500
```

## Pack Search Order

1. Project-local: `<project>/.claude/mascot-packs/<pack-name>/`
2. User-global: `~/.claude/plugins/claude-code-mascot/packs/<pack-name>/`
3. Bundled: `packs/<pack-name>/` (ships with plugin)
