# State Design Guide

## All 10 Mascot States

| State | Trigger | Duration | Meaning |
|-------|---------|----------|---------|
| `idle` | No activity | Loops | Waiting for user input |
| `thinking` | User prompt submitted | Loops (300ms/frame) | LLM generating response |
| `tool_running` | Tool executing | Loops (200ms/frame) | Active tool call |
| `tool_success` | Tool returned OK | Hold 1000ms | Brief success flash |
| `tool_failure` | Tool returned error | Hold 1500ms | Brief failure indicator |
| `question` | Needs user input | Static | Waiting for clarification |
| `permission` | Permission request | Static | Asking for approval |
| `subagent_running` | Subagent active | Loops (200ms/frame) | Delegated work in progress |
| `done` | Response complete | Hold 2000ms | Task finished |
| `auth_success` | Auth completed | Hold 2000ms | Authentication success |

## Design Principles

### Motion vs Emotion

**Motion states** (tool_running, thinking, subagent_running):
- Animate with 2-3 frames minimum
- Change limb/body position between frames
- Add motion effects (speed lines, dots) at sprite edges
- Keep face recognizable across frames

**Emotion states** (tool_success, tool_failure, question):
- Eye shape is the primary differentiator
- Mouth change is secondary
- Peripheral effects (sparkles, sweat, ?, !) are supplementary
- Usually single-frame (hold states)

### Effect Placement Rules

Place effects OUTSIDE the face area to avoid structural interference:

```
Good effect zones (for a 16x16 sprite):
  [E] . . . . . . . . . . . . . [E]   ← corners
  . . . . . . . . . . . . . . . .
  [E] . . . [face area] . . . [E]     ← beside ears
  . . . . . . . . . . . . . . . .
  . . . . . . . . . . . . . . . .
  [E] . . . . . . . . . . . . . [E]   ← below body corners
```

- Sparkles/stars → top corners or beside ears
- Speed lines → left/right edges at body height
- Sweat drop → above or beside head
- ? and ! → above head center or top-right corner

### State Differentiation Checklist

For each new state, verify:

1. **Distinct from idle at a glance** — Cover the state name and ask: can you tell which state this is?
2. **Consistent silhouette** — The character should still be recognizable
3. **No vertical collisions introduced** — Check column-by-column in half-block pairs
4. **Effects don't overlap face** — Sparkles, lines, symbols stay in the margins
5. **Animation frames differ enough** — If multi-frame, each frame should be visibly different

### Minimum Viable Pack

Not every state needs a unique frame. Start with these 4 and use `fallbacks.unknown` for the rest:

1. `idle` — baseline (1-2 frames)
2. `thinking` — active animation (2-3 frames)
3. `tool_success` — positive feedback (1 frame)
4. `done` — completion (1-2 frames)

Add more states incrementally as the design matures.

### Frame Naming Convention

Use descriptive prefixes matching the state, with numeric suffixes for animation frames:

```
idle_1, idle_2          — idle animation cycle
thinking_1, thinking_2  — thinking animation cycle
tool_1, tool_2          — tool_running animation cycle
ok_1                    — tool_success
fail_1                  — tool_failure
question_1              — question
permission_1            — permission
sub_1, sub_2            — subagent_running animation cycle
done_1, done_2          — done animation cycle
auth_1                  — auth_success
```
