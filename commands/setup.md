---
description: Configure claude-code-mascot statusLine and hooks
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

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
