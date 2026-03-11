#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { shellQuote } from "../lib/terminal.js";

interface SettingsShape {
  statusLine?: {
    type: "command";
    command: string;
  };
  hooks?: Record<string, Array<{ matcher?: string; hooks: Array<{ type: "command"; command: string }> }>>;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const pluginRootFlagIndex = process.argv.indexOf("--plugin-root");
  const settingsFlagIndex = process.argv.indexOf("--settings");

  const pluginRoot = path.resolve(
    pluginRootFlagIndex > -1
      ? process.argv[pluginRootFlagIndex + 1]
      : new URL("../..", import.meta.url).pathname
  );
  const settingsPath = path.resolve(
    settingsFlagIndex > -1
      ? process.argv[settingsFlagIndex + 1]
      : path.join(os.homedir(), ".claude", "settings.json")
  );
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
    const hooks = Object.fromEntries(
      hookEvents.map((eventName) => [
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
      ])
    );
    process.stdout.write(
      JSON.stringify(
        {
          statusLine: {
            type: "command",
            command
          },
          hooks
        },
        null,
        2
      )
    );
    process.stdout.write("\n");
    return;
  }

  let settings: SettingsShape = {};
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, "utf8")) as SettingsShape;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const existingCommand = settings.statusLine?.command;
  if (existingCommand && existingCommand !== command && !args.has("--force")) {
    throw new Error(`statusLine already exists in ${settingsPath}; rerun with --force to replace it`);
  }

  settings.statusLine = {
    type: "command",
    command
  };
  settings.hooks = settings.hooks ?? {};

  for (const eventName of hookEvents) {
    const groups = settings.hooks[eventName] ?? [];
    const alreadyInstalled = groups.some((group) =>
      group.hooks.some((hook) => hook.type === "command" && hook.command === hookCommand)
    );
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

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
