# Pixel Buddy Anatomy

Reference analysis of the default `pixel-buddy` pack (16x16, half-block, 10 colors).

## Palette

| Index | Color | Role |
|-------|-------|------|
| 0 | null | Transparent |
| 1 | `#4b556a` | Dark outline / shadow |
| 2 | `#f5d08b` | Body / fur (HEAT TARGET — shifts red at high context%) |
| 3 | `#eaa4bb` | Pink (inner ear, mouth, cheeks) |
| 4 | `#f8fafc` | White (eyes) |
| 5 | `#63d2a1` | Green accent |
| 6 | `#f3c969` | Gold accent |
| 7 | `#7db8ff` | Blue accent (speed lines, effects) |
| 8 | `#ff7a70` | Red accent (warning, failure) |
| 9 | `#a0522d` | Brown (whisker tips, shadow detail) |

## idle_1 Frame Row-by-Row

16x16 grid. Half-block pairs rows: display line = row pair.

```
Row  0: [0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0]  ── ear tips (outline)
Row  1: [0,1,3,2,1,0,0,0,0,0,0,1,2,3,1,0]  ── ear inner (pink+fur)
     ↕ Display line 0: ears
Row  2: [1,2,3,2,2,2,2,2,2,2,2,2,2,3,2,1]  ── head top (pink accents at cols 2,13)
Row  3: [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0]  ── head fill
     ↕ Display line 1: head crown
Row  4: [1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1]  ── eyes: white(4) at cols 4,11; outline(1) at cols 3,12
Row  5: [1,1,2,1,4,2,2,2,2,2,2,4,1,2,1,1]  ── eyes lower half (same pattern)
     ↕ Display line 2: eyes — the most expressive area
Row  6: [9,9,2,1,1,2,2,2,2,2,2,1,1,2,9,9]  ── whiskers: brown(9) at cols 0-1,14-15; outline(1) at cols 3-4,11-12
Row  7: [0,1,2,2,2,2,1,3,3,1,2,2,2,2,1,0]  ── mouth: pink(3) at cols 7-8; outline(1) at cols 6,9
     ↕ Display line 3: whiskers + mouth
Row  8: [0,9,9,2,2,2,2,1,1,2,2,2,2,9,9,0]  ── chin: brown(9) whisker ends
Row  9: [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0]  ── neck top
     ↕ Display line 4: chin / neck transition
Row 10: [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0]  ── body upper
Row 11: [0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0]  ── body wider
     ↕ Display line 5: body
Row 12: [0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0]  ── legs (outline splits)
Row 13: [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0]  ── feet tips
     ↕ Display line 6: legs + feet
Row 14: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]  ── empty (tail area)
Row 15: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]  ── empty
     ↕ Display line 7: tail / ground
```

## Key Structural Columns

| Column | Role |
|--------|------|
| 0-1, 14-15 | Whisker tips (brown), ear edges |
| 2-3 | Left ear / left eye outline border |
| 4 | Left eye (white in rows 4-5) |
| 7-8 | Mouth center (pink in row 7) |
| 11 | Right eye (white in rows 4-5) |
| 12-13 | Right ear / right eye outline border |

## Vertical Collision Example

In `tool_success` (^_^ happy face), the eyes close → white(4) at cols 4,11 disappears.

**Problem**: Row 4 col 4 = outline(1), Row 6 col 4 = outline(1). These form a continuous dark vertical line through display lines 2-3, making eyes visually connect to whiskers.

**Fix**: Change whisker dots at row 6, cols 4 and 11 from outline(1) to body(2). This breaks the dark continuity.

**Lesson**: When changing eyes from open (white breaks the dark line) to closed/narrow, always check cols 3-4 and 11-12 for vertical dark stacking.

## State Variant Design Summary

| State | Key Differences from idle |
|-------|--------------------------|
| idle_2 | Blink frame — eyes close briefly |
| thinking_1-3 | Tilted eyes, swaying animation across 3 frames |
| tool_1, tool_2 | Speed lines(7) on sides, running leg poses, focused narrow eyes |
| ok_1 | ^_^ closed happy eyes, sparkle effects in corners |
| fail_1 | Worried eyes, sweat drop(7), drooping ears |
| question_1 | ? effect, tilted head, one eye bigger |
| permission_1 | ! effect, alert pose, wide eyes |
| sub_1, sub_2 | Similar to tool_running but with different effect color |
| done_1, done_2 | Star/sparkle effects, relaxed happy pose |
| auth_1 | Key/lock effect, brief success indicator |
