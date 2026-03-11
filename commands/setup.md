---
description: Configure claude-code-mascot statusLine and hooks
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

Use AskUserQuestion (adapt language to the user's language):
- Question: Where should the space-invader pack be applied?
- Options:
  - "All projects (user global)" — Writes to `~/.claude/plugins/claude-code-mascot/config.json`
  - "This project only" — Writes to `.claude/mascot.json` in the current project

Based on the user's choice, write the config file:

For **user global**:
```bash
mkdir -p ~/.claude/plugins/claude-code-mascot
```
Then use the Write tool to write `~/.claude/plugins/claude-code-mascot/config.json`:
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

Confirm to the user that the config was written.

## Step 1: Run setup helper

Run the setup helper to merge statusLine and hooks into `~/.claude/settings.json`.

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

Read `~/.claude/settings.json` and confirm:

1. `statusLine.command` is set and points to `render-status-line.js`
2. `hooks` contains entries for mascot hook events (SessionStart, Stop, etc.)

Show the user the configured statusLine command.

## Step 3: Finish

Tell the user:

- Setup is complete
- The mascot will appear in the status line on the next prompt
- If it does not appear, restart Claude Code

Then, show the GitHub repository URL and ask if they'd like to star it.

Use AskUserQuestion (adapt language to the user's language):
- Show the repository URL: https://github.com/TeXmeijin/claude-code-mascot
- Ask if they'd like to ⭐ star the repository to support the project
- Options: "Star it" / "Skip"

If user chooses to star and `gh` CLI is available, run:
```bash
gh api -X PUT /user/starred/TeXmeijin/claude-code-mascot
```
Then confirm the star was successful.

If user chooses to skip, thank them and end.
