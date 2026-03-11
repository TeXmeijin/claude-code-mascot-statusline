#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import { getClaudeConfigDir, APP_HOME } from "../lib/constants.js";

interface SettingsShape {
  statusLine?: {
    type: "command";
    command: string;
  };
  hooks?: Record<string, Array<{ matcher?: string; hooks: Array<{ type: "command"; command: string }> }>>;
  [key: string]: unknown;
}

interface DryRunReport {
  settingsPath: string;
  removeStatusLine: boolean;
  removeHookEvents: string[];
  removeDataDir: string | null;
}

function isMascotStatusLine(command: string | undefined): boolean {
  return typeof command === "string" && command.includes("render-status-line.js");
}

function isMascotHookGroup(group: { hooks: Array<{ type: string; command: string }> }): boolean {
  return group.hooks.some(
    (hook) => hook.type === "command" && hook.command.includes("hook-state-writer.js")
  );
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const settingsFlagIndex = process.argv.indexOf("--settings");

  const settingsPath = path.resolve(
    settingsFlagIndex > -1
      ? process.argv[settingsFlagIndex + 1]
      : path.join(getClaudeConfigDir(), "settings.json")
  );

  let settings: SettingsShape = {};
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, "utf8")) as SettingsShape;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const removeStatusLine = isMascotStatusLine(settings.statusLine?.command);

  const removeHookEvents: string[] = [];
  if (settings.hooks) {
    for (const [eventName, groups] of Object.entries(settings.hooks)) {
      if (groups.some(isMascotHookGroup)) {
        removeHookEvents.push(eventName);
      }
    }
  }

  let removeDataDir: string | null = null;
  try {
    await fs.access(APP_HOME);
    removeDataDir = APP_HOME;
  } catch {
    // directory does not exist
  }

  if (!args.has("--write")) {
    const report: DryRunReport = {
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
      if (!groups) continue;
      const filtered = groups.filter((group) => !isMascotHookGroup(group));
      if (filtered.length === 0) {
        delete settings.hooks[eventName];
      } else {
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
  } else {
    process.stdout.write(`No mascot entries found in ${settingsPath}\n`);
  }

  if (removeDataDir) {
    await fs.rm(removeDataDir, { recursive: true, force: true });
    process.stdout.write(`Removed ${removeDataDir}\n`);
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
