# Mascot Pack Spec v2

This plugin does not accept ASCII art or line-art frames.

Character authors provide pixel sprites, not display strings.
Each frame is a fixed-size 2D grid of palette indexes, and the renderer converts that sprite data into terminal output with ANSI background colors or block glyphs.

## Prohibited

- `/`, `\`, `(`, `)`, `^`, `<`, `>` and similar characters as visible outlines
- Face glyphs or kaomoji
- “Cat-looking strings” or any other line-art built from meaningful characters
- Packs whose visual shape depends on reading the characters themselves

## Required

- `specVersion` must be `2`
- One pack is one directory containing `pack.json` or `pack.yaml`
- `sprite.width` and `sprite.height` define the fixed grid size
- `sprite.palette` defines terminal colors by palette index
- Every sprite frame is a 2D integer matrix using those palette indexes
- Every frame in a pack must match the same `width × height`
- `fallbacks.unknown` is required
- Rendering must come from sprite cells, not pre-rendered strings

## Supported Top-Level Keys

- `name`
- `specVersion`
- `displayName`
- `author`
- `description`
- `sprite`
- `sprites`
- `states`
- `fallbacks`
- `timing`
- `meta`

## Sprite Object

```json
{
  "width": 8,
  "height": 8,
  "palette": [null, "#1f2430", "#f3d5b5", "#63d2a1"],
  "renderMode": "bg-space",
  "pixelWidth": 2
}
```

- `palette[0]` should normally be `null` or `"transparent"`
- `renderMode` supports `bg-space` and `half-block`
- `pixelWidth` controls horizontal scaling in `bg-space` mode

## Frame Format

```json
{
  "sprites": {
    "idle_1": [
      [0, 1, 0, 0, 0, 0, 1, 0],
      [1, 2, 1, 0, 0, 1, 2, 1],
      [1, 2, 2, 1, 1, 2, 2, 1],
      [1, 2, 4, 2, 2, 4, 2, 1],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [0, 1, 2, 3, 3, 2, 1, 0],
      [0, 0, 1, 2, 2, 1, 0, 0],
      [0, 1, 0, 0, 0, 0, 1, 0]
    ]
  }
}
```

Validation rules:

- Rows must equal `sprite.height`
- Columns must equal `sprite.width`
- Every cell must be an integer
- Every cell value must be within the palette range

## Example State Mapping

```json
{
  "states": {
    "idle": ["idle_1", "idle_2"],
    "thinking": ["thinking_1", "thinking_2", "thinking_3"],
    "done": ["done_1"]
  },
  "fallbacks": {
    "unknown": "idle_1",
    "narrow": "idle_2"
  }
}
```

## Acceptance Standard

- The result reads as a sprite, not ASCII art
- The smallest unit is a cell, not a meaningful character
- Turning color off still leaves a block-based sprite
- All animation differences come from frame-to-frame pixel changes

## Search Order

1. `<project>/.claude/mascot-packs/<pack-name>`
2. `~/.claude/plugins/claude-code-mascot-statusline/packs/<pack-name>`
3. Bundled plugin packs in `packs/`
