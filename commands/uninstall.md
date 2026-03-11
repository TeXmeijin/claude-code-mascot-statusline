---
description: Remove claude-code-mascot statusLine, hooks, and runtime data
allowed-tools: Bash, Read, AskUserQuestion
---

## Step 1: Dry-run

Run the uninstall helper in dry-run mode to show what will be removed:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli/uninstall-helper.js"
```

Show the output to the user. Explain each item (statusLine, hooks, data directory) clearly.

If nothing is found to remove, tell the user and stop.

## Step 2: Confirm

Use AskUserQuestion (adapt language to the user's language):
- Show what will be removed
- Options: "Proceed" / "Cancel"

If user cancels, stop.

## Step 3: Execute

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli/uninstall-helper.js" --write
```

## Step 4: Finish

Tell the user:
- Uninstall is complete
- The mascot will stop appearing after restarting Claude Code
