#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { getClaudeConfigDir } from "../lib/constants.js";
import { shellQuote } from "../lib/terminal.js";
async function main() {
    const args = new Set(process.argv.slice(2));
    const pluginRootFlagIndex = process.argv.indexOf("--plugin-root");
    const settingsFlagIndex = process.argv.indexOf("--settings");
    const pluginRoot = path.resolve(pluginRootFlagIndex > -1
        ? process.argv[pluginRootFlagIndex + 1]
        : new URL("../..", import.meta.url).pathname);
    const settingsPath = path.resolve(settingsFlagIndex > -1
        ? process.argv[settingsFlagIndex + 1]
        : path.join(getClaudeConfigDir(), "settings.json"));
    const command = `node ${shellQuote(path.join(pluginRoot, "dist/cli/render-status-line.js"))}`;
    const hookCommand = `node ${shellQuote(path.join(pluginRoot, "dist/cli/hook-state-writer.js"))}`;
    const hookEvents = [
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PermissionRequest",
        "PostToolUse",
        "PostToolUseFailure",
        "Notification",
        "SubagentStart",
        "SubagentStop",
        "Stop",
        "SessionEnd"
    ];
    if (!args.has("--write")) {
        const hooks = Object.fromEntries(hookEvents.map((eventName) => [
            eventName,
            [
                {
                    matcher: "",
                    hooks: [
                        {
                            type: "command",
                            command: hookCommand
                        }
                    ]
                }
            ]
        ]));
        process.stdout.write(JSON.stringify({
            statusLine: {
                type: "command",
                command
            },
            hooks
        }, null, 2));
        process.stdout.write("\n");
        return;
    }
    let settings = {};
    try {
        settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
    const existingCommand = settings.statusLine?.command;
    if (existingCommand && existingCommand !== command) {
        process.stderr.write(`Replacing existing statusLine command:\n  - ${existingCommand}\n  + ${command}\n`);
    }
    settings.statusLine = {
        type: "command",
        command
    };
    settings.hooks = settings.hooks ?? {};
    for (const eventName of hookEvents) {
        const groups = settings.hooks[eventName] ?? [];
        const alreadyInstalled = groups.some((group) => group.hooks.some((hook) => hook.type === "command" && hook.command === hookCommand));
        if (!alreadyInstalled) {
            groups.push({
                matcher: "",
                hooks: [
                    {
                        type: "command",
                        command: hookCommand
                    }
                ]
            });
        }
        settings.hooks[eventName] = groups;
    }
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    process.stdout.write(`Updated ${settingsPath}\n`);
}
main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
//# sourceMappingURL=setup-helper.js.map