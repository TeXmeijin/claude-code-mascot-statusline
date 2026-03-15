# Claude Code Mascot

A pixel-sprite mascot that lives in your Claude Code status line.

[日本語版はこちら / Japanese](README.ja.md)

![Claude Code Mascot screenshot](docs/screenshot.png)
![Claude Code Mascot success](docs/screenshot-success.png)
![Claude Code Mascot demo](docs/demo.gif)

## Concept

Claude Code has dramatically improved development efficiency — but it has also increased cognitive load. In the middle of intense coding sessions, we need a little moment of comfort.

This mascot changes its expression every time a tool runs during your session. When context window usage gets critical, it turns bright red in panic. You can even create your own custom character pack (this is still in beta — give it a try!).

For engineers who find themselves more and more consumed by their work — a small dose of comfort, right in your terminal.

## Personality

- **Pixel-art mascot** rendered directly in the terminal — not ASCII art
- **Reacts to 9 session states**: idle, thinking, tool running, tool success, tool failure, permission prompt, subagent running, done, and auth success
- **Heat-map color shift**: the mascot's fur color shifts toward red as context window usage increases
- **Status summary**: git branch, model name, tool count, context %, and API usage
- **Custom mascot packs**: create and share your own characters

## How It Works

The mascot detects session state through Claude Code's [hook system](https://docs.anthropic.com/en/docs/claude-code/hooks). Each hook event (tool start, tool success, permission request, etc.) updates the mascot's internal state, and the status line renders the corresponding expression.

Because this is event-driven rather than continuous polling, the displayed state may not always reflect the exact real-time status of your session. For example, there can be brief delays or missed transitions depending on hook timing. Think of it as a companion that reacts to events — not a precise status monitor.

## Bring One Home

### Via Claude Code Plugin Marketplace (Recommended)

```
/plugin marketplace add TeXmeijin/claude-code-mascot-statusline
/plugin install claude-code-mascot-statusline
```

Then run the setup skill to configure your status line and hooks:

```
/claude-code-mascot-statusline:setup
```

### Manual Install

```bash
git clone https://github.com/TeXmeijin/claude-code-mascot-statusline.git
cd claude-code-mascot-statusline
npm install && npm run build
node dist/cli/setup-helper.js --write
```

Existing `statusLine` is replaced automatically. Hook entries are merged without removing your existing hooks.

> A second built-in pack **space-invader** is also available — useful for distinguishing between projects or accounts.
>
> ![Space Invader pack](docs/screenshot-space-invader.png)

## Create Your Own Companion

The mascot is fully swappable. You can create your own character pack and use it instead of the default cat.

### Pack search order

1. **Project-local**: `<project>/.claude/mascot-packs/<pack-name>/`
2. **User-global**: `~/.claude/plugins/claude-code-mascot-statusline/packs/<pack-name>/`
3. **Bundled**: `packs/<pack-name>/` (ships with the plugin)

### Creating a custom pack

1. Copy `examples/external-pack/pack.yaml` as a starting point
2. Place your pack in `~/.claude-mascot/packs/<your-pack-name>/pack.json` (or `pack.yaml`)
3. Set the pack name in `~/.claude/plugins/claude-code-mascot-statusline/config.json`:

```json
{
  "pack": "your-pack-name"
}
```

4. Validate your pack:

```bash
node dist/cli/validate-pack.js ~/.claude/plugins/claude-code-mascot-statusline/packs/your-pack-name
```

5. Preview it:

```bash
node dist/cli/storybook.js --pack your-pack-name
```

See [docs/pack-spec.md](docs/pack-spec.md) for the full pack specification.

> **Tip:** You can also use the `/create-mascot-pack` skill in Claude Code to create or iterate on a pack interactively.

## Configuration

### Config files

- **User config**: `~/.claude/plugins/claude-code-mascot-statusline/config.json`
- **Project config**: `.claude/mascot.json` (overrides user config)

```json
{
  "pack": "pixel-buddy",
  "color": "auto",
  "twoLine": true,
  "renderProfile": "claude-code-safe",
  "safeBackground": "#000000"
}
```

### Environment variables

| Variable | Description |
|---|---|
| `CLAUDE_MASCOT_PACK` | Override the active pack name |
| `CLAUDE_MASCOT_COLOR` | Set to `never` to disable colors |
| `CLAUDE_MASCOT_WIDTH_HINT` | Hint the available width for narrow mode |
| `NO_COLOR` | Standard no-color flag (disables ANSI colors) |

### Render profiles

- `claude-code-safe` (default): keeps `half-block` rendering for visible pixels, emits transparent cells as background-colored non-breaking spaces to prevent host trimming
- `auto`: uses the pack's declared renderer exactly as-is

## CLI Tools

Run from the plugin root directory (`cd` into your clone or install path):

```bash
# View all states in a storybook-style gallery
node dist/cli/storybook.js --pack pixel-buddy

# Preview a specific state
node dist/cli/preview-pack.js --pack pixel-buddy --state thinking --frames 3 --color always

# Validate a pack file
node dist/cli/validate-pack.js ./packs/pixel-buddy

# Compare render profiles side by side
node dist/cli/statusline-lab.js --pack pixel-buddy --profiles auto,claude-code-safe

# Render status line manually (pipe JSON to stdin)
printf '{"session_id":"demo","workspace":{"project_dir":"%s","current_dir":"%s"}}' "$PWD" "$PWD" \
  | node dist/cli/render-status-line.js

# Run setup to write statusLine and hooks into settings.json
node dist/cli/setup-helper.js --write
```

## Development

```bash
git clone https://github.com/TeXmeijin/claude-code-mascot-statusline.git
cd claude-code-mascot-statusline
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Contributing

- **Bug fixes**: If you find a clear bug, please open a pull request.
- **Custom mascots for yourself**: Create a custom pack locally — no need to upstream it.
- **New mascot packs for everyone**: If you've made something great, open a PR to add it as an additional built-in pack. We'd love to see it!
- **Creating packs with Claude Code**: Use the `/create-mascot-pack` skill to scaffold and iterate on new packs interactively.

## Technical Details: Narrow Terminal Support

Claude Code's internal statusLine renderer uses Ink's `<Text wrap="truncate">`, which invokes `cli-truncate` on the entire multi-line output as a single string. When **any line** exceeds the statusLine container's available width, all subsequent lines are silently dropped — causing the mascot sprite to show only its top rows (typically just the ears).

This is a known Claude Code behavior documented in several open issues:

- [anthropics/claude-code#28750](https://github.com/anthropics/claude-code/issues/28750) — Multi-line statusline second line disappears on narrow terminals (internal `wrap: "truncate"` identified in [comment](https://github.com/anthropics/claude-code/issues/28750#issuecomment-3962324753))
- [anthropics/claude-code#27305](https://github.com/anthropics/claude-code/issues/27305) — StatusLine compressed when notification banners are active (`flexShrink: 1`)
- [anthropics/claude-code#27864](https://github.com/anthropics/claude-code/issues/27864) — Footer layout structure extracted from cli.js (`isNarrow` row/column switch)
- [anthropics/claude-code#22115](https://github.com/anthropics/claude-code/issues/22115) — Terminal columns not passed to statusLine commands

The trigger is almost always the **summary text line** (state, project name, branch, model, usage stats joined with `|`), which can easily exceed 80 characters. The sprite lines themselves are only 16 characters wide in half-block mode.

### How this plugin works around it

1. **Dynamic terminal width detection** — Since statusLine commands run as piped child processes (`process.stdout.columns` is `undefined`), we detect the real terminal size by finding the parent process's TTY device via `ps` and querying it with `stty size`. Results are cached with a 5-second TTL to minimize overhead.

2. **Automatic summary line wrapping** — The summary text is split at `|` separators and reassembled into multiple lines, each constrained to `terminal_cols - 10` characters. This ensures no line exceeds the container width, preventing `cli-truncate` from activating.

3. **Configurable summary items** — Users can reduce the summary length by choosing which items to display via `summaryItems` in their config:

   ```json
   {
     "summaryItems": ["project", "branch", "context", "usage5h"]
   }
   ```

   Available keys: `project`, `branch`, `model`, `tools`, `failures`, `subagents`, `context`, `usage5h`, `usage7d`

These techniques were developed by analyzing Claude Code v2.1.76's bundled binary (2026-03-15). The internal layout structure places the statusLine in a flex container with `flexShrink: 1`, and the footer switches between `row` layout (cols ≥ 80, statusLine gets ~half width) and `column` layout (cols < 80, full width). The parent-process TTY approach is also used by [ccstatusline](https://github.com/sirmalloc/ccstatusline) and [claude-powerline](https://github.com/Owloops/claude-powerline).

## Good Bye

Run the uninstall command inside Claude Code:

```
/claude-code-mascot-statusline:uninstall
```

This removes the `statusLine` entry, all mascot hook entries from your settings, and the runtime data directory. Restart Claude Code to complete the removal.

## License

[MIT](LICENSE)
