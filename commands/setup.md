---
description: Configure claude-code-mascot-statusline statusLine and hooks
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion
---

## Step 0: Choose mascot pack

Ask the user which mascot pack they want to use.

Use AskUserQuestion (adapt language to the user's language):
- Question: Which mascot pack would you like to use?
- Options:
  - "pixel-buddy" — A pixel-art cat that reacts to your coding session (default)
  - "space-invader" — A retro arcade-style space invader

If the user chooses **pixel-buddy**, skip to Step 1 (it's the default, no config needed).

If the user chooses **space-invader**, proceed to Step 0.5.

## Step 0.5: Choose scope (space-invader only)

Ask the user where they want to apply the space-invader pack.

The config directory is `$CLAUDE_CONFIG_DIR` if set, otherwise `~/.claude`. Resolve it first:
```bash
echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
```

Use AskUserQuestion (adapt language to the user's language):
- Question: Where should the space-invader pack be applied?
- Options:
  - "All projects (user global)" — Writes to `<config-dir>/plugins/claude-code-mascot-statusline/config.json`
  - "This project only" — Writes to `.claude/mascot.json` in the current project

Based on the user's choice, write the config file:

For **user global**:
```bash
mkdir -p "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/claude-code-mascot-statusline"
```
Then use the Write tool to write `<resolved-config-dir>/plugins/claude-code-mascot-statusline/config.json`:
```json
{
  "pack": "space-invader"
}
```

For **this project only**:
```bash
mkdir -p .claude
```
Then use the Write tool to write `.claude/mascot.json`:
```json
{
  "pack": "space-invader"
}
```

Confirm to the user which path was written.

## Step 0.7: Customize summary items (optional)

Ask the user if they want to customize which items appear in the status line summary.

Use AskUserQuestion (adapt language to the user's language):
- Question: Would you like to customize the status line summary items?
- Options:
  - "Show all (default)" — Show all available items
  - "Customize" — Choose which items to display

If the user chooses **Show all**, skip to Step 1.

If the user chooses **Customize**, ask in two rounds.

**Round 1 — Basic info** (AskUserQuestion, multiSelect: true):
- Question: Which basic info items to show?
- Options:
  - `project` — Project directory name
  - `branch` — Git branch
  - `model` — Model name (e.g., Opus 4.6)
  - `context` — Context window usage %

**Round 2 — Monitoring** (AskUserQuestion, multiSelect: true):
- Question: Which monitoring items to show?
- Options:
  - `usage5h` — 5-hour API usage %
  - `usage7d` — 7-day API usage %
  - "Tool activity" — Tool call count, failure count, and active subagent count (`tools`, `failures`, `subagents` as a group)

Combine the user's selections from both rounds to build the final `summaryItems` array. If the user selected "Tool activity", expand it to `["tools", "failures", "subagents"]`.

Then ask for scope:

Use AskUserQuestion (adapt language to the user's language):
- Question: Where should this setting be saved?
- Options:
  - "All projects (user global)" — Writes to `<config-dir>/plugins/claude-code-mascot-statusline/config.json`
  - "This project only" — Writes to `.claude/mascot.json` in the current project

Write the config file at the chosen scope. If the file already exists, **merge** the `summaryItems` field without overwriting other settings. Use the Read tool to check for existing content first.

Example config:
```json
{
  "summaryItems": ["project", "branch", "context", "usage5h", "usage7d"]
}
```

## Step 1: Run setup helper

Run the setup helper to merge statusLine and hooks into the user's settings.json (respects `$CLAUDE_CONFIG_DIR`).

The `--plugin-root` flag tells the helper where the plugin is installed:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli/setup-helper.js" --write --plugin-root "${CLAUDE_PLUGIN_ROOT}"
```

If the command fails with "Cannot find module", the plugin may not be built. Try:

```bash
cd "${CLAUDE_PLUGIN_ROOT}" && npm run build && cd -
node "${CLAUDE_PLUGIN_ROOT}/dist/cli/setup-helper.js" --write --plugin-root "${CLAUDE_PLUGIN_ROOT}"
```

## Step 2: Verify

Read the settings.json that was just updated and confirm:

1. `statusLine.command` is set and points to `render-status-line.js`
2. `hooks` contains entries for mascot hook events (SessionStart, Stop, etc.)

Show the user the configured statusLine command.

Then, verify the render script actually works by running it with empty input:

```bash
echo '{}' | node "${CLAUDE_PLUGIN_ROOT}/dist/cli/render-status-line.js" 2>&1
```

If it fails (e.g., `Cannot find package` / `ERR_MODULE_NOT_FOUND`), install dependencies and retry:

```bash
cd "${CLAUDE_PLUGIN_ROOT}" && npm install --production && cd -
echo '{}' | node "${CLAUDE_PLUGIN_ROOT}/dist/cli/render-status-line.js" 2>&1
```

If it still fails, show the error to the user and stop.

## Step 3: Finish

Tell the user:

- Setup is complete
- The mascot will appear in the status line on the next prompt
- If it does not appear, restart Claude Code

Then, show the GitHub repository URL and ask if they'd like to star it.

Use AskUserQuestion (adapt language to the user's language):
- Show the repository URL: https://github.com/TeXmeijin/claude-code-mascot-statusline
- Ask if they'd like to ⭐ star the repository to support the project
- Options: "Star it" / "Skip"

If user chooses to star and `gh` CLI is available, run:
```bash
gh api -X PUT /user/starred/TeXmeijin/claude-code-mascot-statusline
```
Then confirm the star was successful.

If user chooses to skip, thank them and end.
