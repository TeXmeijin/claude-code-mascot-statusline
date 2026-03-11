#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { getClaudeConfigDir, APP_HOME } from "../lib/constants.js";
function isMascotStatusLine(command) {
    return typeof command === "string" && command.includes("render-status-line.js");
}
function isMascotHookGroup(group) {
    return group.hooks.some((hook) => hook.type === "command" && hook.command.includes("hook-state-writer.js"));
}
async function main() {
    const args = new Set(process.argv.slice(2));
    const settingsFlagIndex = process.argv.indexOf("--settings");
    const settingsPath = path.resolve(settingsFlagIndex > -1
        ? process.argv[settingsFlagIndex + 1]
        : path.join(getClaudeConfigDir(), "settings.json"));
    let settings = {};
    try {
        settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
    const removeStatusLine = isMascotStatusLine(settings.statusLine?.command);
    const removeHookEvents = [];
    if (settings.hooks) {
        for (const [eventName, groups] of Object.entries(settings.hooks)) {
            if (groups.some(isMascotHookGroup)) {
                removeHookEvents.push(eventName);
            }
        }
    }
    let removeDataDir = null;
    try {
        await fs.access(APP_HOME);
        removeDataDir = APP_HOME;
    }
    catch {
        // directory does not exist
    }
    if (!args.has("--write")) {
        const report = {
            settingsPath,
            removeStatusLine,
            removeHookEvents,
            removeDataDir,
        };
        process.stdout.write(JSON.stringify(report, null, 2));
        process.stdout.write("\n");
        return;
    }
    // --- write mode ---
    let changed = false;
    if (removeStatusLine) {
        delete settings.statusLine;
        changed = true;
    }
    if (settings.hooks) {
        for (const eventName of removeHookEvents) {
            const groups = settings.hooks[eventName];
            if (!groups)
                continue;
            const filtered = groups.filter((group) => !isMascotHookGroup(group));
            if (filtered.length === 0) {
                delete settings.hooks[eventName];
            }
            else {
                settings.hooks[eventName] = filtered;
            }
        }
        if (Object.keys(settings.hooks).length === 0) {
            delete settings.hooks;
        }
        changed = true;
    }
    if (changed) {
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
        process.stdout.write(`Updated ${settingsPath}\n`);
    }
    else {
        process.stdout.write(`No mascot entries found in ${settingsPath}\n`);
    }
    if (removeDataDir) {
        await fs.rm(removeDataDir, { recursive: true, force: true });
        process.stdout.write(`Removed ${removeDataDir}\n`);
    }
}
main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
//# sourceMappingURL=uninstall-helper.js.map