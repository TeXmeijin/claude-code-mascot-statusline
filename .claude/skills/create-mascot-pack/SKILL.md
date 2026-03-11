---
name: create-mascot-pack
description: >
  Create or modify pixel-art mascot packs for claude-code-mascot plugin.
  Use when: creating a new character pack from scratch, modifying existing pack sprites,
  fixing visual issues in half-block rendering, iterating on sprite design, or adding new states to a pack.
  Triggers: "create pack", "new mascot", "pixel art", "make character",
  "edit sprite", "fix sprite", "パック作成", "キャラ作成", "スプライト編集",
  "new pack", "mascot pack", "インベーダー", "キャラクター"
---

# Create Mascot Pack

Interactive assistant for creating and modifying pixel-art mascot packs for the claude-code-mascot plugin.

## Workflow Decision

Determine the task type:

**Creating a new pack?** → Follow "New Pack Workflow" below
**Modifying an existing pack?** → Follow "Existing Pack Workflow" below

## New Pack Workflow

### Phase 1: Requirements

Ask the user:
1. Character concept (animal, robot, invader, object, etc.)
2. Grid size — recommend **16x16** for half-block, **8x8** for simpler characters
3. Render mode — **half-block** (recommended for faces/characters) or **bg-space** (simpler)
4. Pack name (lowercase, hyphens, e.g. `space-invader`)
5. Install location:
   - Project-local: `<project>/.claude/mascot-packs/<name>/`
   - User-global: `~/.claude/plugins/claude-code-mascot/packs/<name>/`

### Phase 2: Palette Design

Design the color palette. Rules:

- **Index 0** = `null` (transparent) — always required
- **Index 1** = outline / dark color — defines the silhouette
- **Index 2** = main body color — **this is the heat target** (shifts toward `#ff4444` when context window usage reaches 60-85%). Choose a warm or neutral color that looks good interpolating toward red.
- **Index 3+** = accent colors (eyes, mouth, effects, highlights)
- Recommend 5-10 colors total

Read `references/pixel-buddy-anatomy.md` for palette reference (10-color example).

### Phase 3: Idle Sprite Design

The idle frame is the **baseline** for all other states. Get this right first.

Design approach:
1. Sketch the silhouette first — all non-zero cells form the shape
2. Place outline (index 1) at edges for clear contour
3. Fill body with index 2
4. Add face features: eyes, mouth, ears, etc.
5. Ensure left-right symmetry unless intentionally asymmetric

**Critical: Half-block awareness** (see "Half-Block Rendering" section below).

Write the frame as a 2D integer array in `pack.yaml` (preferred) or `pack.json`.

### Phase 4: Validate and Preview

After creating the idle frame, immediately validate and preview:

```bash
# Validate pack structure
node dist/cli/validate-pack.js <pack-dir>

# Preview idle state
node dist/cli/preview-pack.js --dir <pack-dir> --state idle --color always

# Check visual metrics
node dist/cli/storybook.js --dir <pack-dir> --states idle --metrics --color always
```

Review visual lint warnings:
- `overall` center offset should be near 0 (±0.35 acceptable)
- `mirror` mismatch should be < 0.18 (unless intentionally asymmetric)
- `top`/`bottom` band offsets should be < ±0.5

Iterate with the user until the idle frame looks good.

### Phase 5: State Variants

Read `references/state-design-guide.md` for the full guide on all 10 states.

Start with a **minimum viable pack** (4 states + fallback):
1. `idle` — baseline (1-2 frames)
2. `thinking` — active animation (2-3 frames)
3. `tool_success` — positive feedback (1 frame)
4. `done` — completion (1-2 frames)

Set `fallbacks.unknown: idle_1` to cover missing states.

For each new state:
1. Copy the idle frame as starting point
2. Modify only what's needed for the expression/animation
3. Run the vertical collision check (see below)
4. Preview with `node dist/cli/preview-pack.js --dir <pack-dir> --state <state> --color always`

### Phase 6: Full Validation

```bash
node dist/cli/storybook.js --dir <pack-dir> --color always --metrics
```

Review every state. Fix visual lint warnings.

### Phase 7: Timing and Fallbacks

Set required fallbacks and optional timing in the pack file:

```yaml
fallbacks:
  unknown: idle_1    # REQUIRED
  narrow: idle_1     # optional
timing:              # optional — defaults are sensible
  idleFramePeriodMs: 500
  thinkingFramePeriodMs: 300
```

### Phase 8: Activate

Tell the user how to activate:

```bash
# Environment variable (temporary)
export CLAUDE_MASCOT_PACK=<pack-name>

# Project config (.claude/mascot.json)
{"pack": "<pack-name>"}

# User config (~/.claude/plugins/claude-code-mascot/config.json)
{"pack": "<pack-name>"}
```

## Existing Pack Workflow

1. Find the pack: search `packs/`, `~/.claude/plugins/claude-code-mascot/packs/`, `.claude/mascot-packs/`
2. Read the current pack manifest
3. Show current sprites: `node dist/cli/storybook.js --dir <pack-dir> --color always --metrics`
4. Make targeted edits to specific frames
5. Re-validate after each change
6. Run storybook for final review

## Half-Block Rendering

This is the most critical knowledge for sprite editing. Read this before modifying any half-block pack.

### Row Pairing

In half-block mode, consecutive row pairs render as one display line:

```
Row 0 + Row 1  → Display line 0  (Row 0 = upper ▀, Row 1 = lower ▄)
Row 2 + Row 3  → Display line 1
Row 4 + Row 5  → Display line 2
...
```

A 16-pixel-tall sprite produces 8 display lines. When editing a pixel, think about which display line it affects.

### Cell Rendering

For each column in a row pair (top pixel, bottom pixel):

| Top | Bottom | Output |
|-----|--------|--------|
| null | null | space |
| color | null | `▀` (fg = top color) |
| null | color | `▄` (fg = bottom color) |
| same | same | `█` (fg = that color) |
| colorA | colorB | `▀` (fg = top, bg = bottom) |

### Vertical Collision Rule

**When the same column has dark/outline colors in adjacent row pairs, they create an unwanted continuous vertical line.**

Example from pixel-buddy `tool_success`:
- Row 4, col 4 = outline(1) — closed eye
- Row 6, col 4 = outline(1) — whisker dot
- Display lines 2 and 3 both show dark in col 4 → eyes visually connect to whiskers

**Fix**: Change one of the colliding cells to body color (index 2) to break the dark continuity.

### Verification Procedure

After any sprite edit:

1. For each modified column, list the palette indices vertically
2. Group into row pairs: (0,1), (2,3), (4,5), ...
3. Check: does the same column have outline/dark color in consecutive display lines?
4. If yes → change one cell to body color or another lighter color
5. Preview to confirm: `node dist/cli/preview-pack.js --dir <pack-dir> --state <state> --color always`

### Common Traps

- **Closing eyes**: Open eyes have white(4) that interrupts dark lines. Closed eyes remove this interruption → check for new vertical collisions at eye columns
- **Widening mouth outline**: May align with whisker or eye outlines in the same column
- **Adding effects at sprite edges**: May create unintended dark borders if outline color is used

## References

- `references/pack-spec-quick.md` — Pack spec v2 fields, validation rules, and minimal template
- `references/pixel-buddy-anatomy.md` — Detailed analysis of pixel-buddy's structure, palette roles, and row layout
- `references/state-design-guide.md` — All 10 states with design guidelines, effect placement rules, and differentiation checklist

Read `packs/pixel-buddy/pack.json` in the plugin directory as a full working 16x16 reference.
