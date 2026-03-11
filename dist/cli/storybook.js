#!/usr/bin/env node
import path from "node:path";
import { getSpriteNamesForState, loadPack, listAvailablePacks, validatePackDirectory } from "../lib/pack.js";
import { renderSprite } from "../lib/renderer.js";
import { analyzeSpriteFrame, formatVisualLint } from "../lib/visual-lint.js";
import { MASCOT_STATES } from "../lib/types.js";
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const colorEnabled = args.color !== "never";
    const narrow = args.width !== null && args.width < 72;
    if (args.listOnly) {
        const packs = args.dir
            ? [await validatePackDirectory(path.resolve(args.dir))]
            : await listAvailablePacks({ cwd: process.cwd() });
        process.stdout.write(renderPackIndex(packs));
        return;
    }
    const packs = await resolveTargetPacks(args);
    const states = args.states.length > 0 ? args.states : [...MASCOT_STATES];
    const sections = [];
    for (const pack of packs) {
        sections.push(renderPackHeader(pack));
        for (const state of states) {
            const spriteNames = getSpriteNamesForState(pack, state, narrow);
            if (spriteNames.length === 0) {
                continue;
            }
            sections.push(`State: ${state}`);
            sections.push(`Feedback key base: ${pack.manifest.name}:${state}`);
            const framesToShow = spriteNames.slice(0, args.frames);
            framesToShow.forEach((spriteName, index) => {
                const sprite = pack.manifest.sprites[spriteName];
                sections.push(`[${pack.manifest.name}:${state}:${index + 1}] ${spriteName}`);
                sections.push(renderSprite(pack, sprite, {
                    colorEnabled,
                    narrow
                }));
                if (args.metrics) {
                    sections.push(...formatVisualLint(analyzeSpriteFrame(sprite)));
                }
            });
        }
    }
    process.stdout.write(sections.join("\n\n"));
    process.stdout.write("\n");
}
function parseArgs(argv) {
    const flags = new Map();
    const switches = new Set();
    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        if (!current?.startsWith("--")) {
            continue;
        }
        const key = current.slice(2);
        const next = argv[index + 1];
        if (next && !next.startsWith("--")) {
            flags.set(key, next);
            index += 1;
        }
        else {
            switches.add(key);
        }
    }
    const states = (flags.get("states") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => MASCOT_STATES.includes(value));
    return {
        pack: flags.get("pack") ?? null,
        dir: flags.get("dir") ?? null,
        allPacks: switches.has("all-packs"),
        listOnly: switches.has("list"),
        states,
        frames: Math.max(1, Number.parseInt(flags.get("frames") ?? "3", 10)),
        color: flags.get("color") === "never" ? "never" : "always",
        width: flags.get("width") ? Number.parseInt(flags.get("width"), 10) : null,
        metrics: switches.has("metrics")
    };
}
async function resolveTargetPacks(args) {
    if (args.dir) {
        return [await validatePackDirectory(path.resolve(args.dir))];
    }
    if (args.allPacks) {
        return listAvailablePacks({ cwd: process.cwd() });
    }
    return [await loadPack({ packName: args.pack ?? undefined, cwd: process.cwd() })];
}
function renderPackHeader(pack) {
    const lines = [
        `Pack: ${pack.manifest.displayName} (${pack.manifest.name})`,
        `Size: ${pack.manifest.sprite.width}x${pack.manifest.sprite.height}`,
        `Render: ${pack.manifest.sprite.renderMode ?? "bg-space"}`,
        `Path: ${pack.rootDir}`
    ];
    if (pack.manifest.description) {
        lines.push(`Description: ${pack.manifest.description}`);
    }
    return lines.join("\n");
}
function renderPackIndex(packs) {
    const lines = ["Available packs:"];
    for (const pack of packs) {
        lines.push(`- ${pack.manifest.name}: ${pack.manifest.displayName} (${pack.manifest.sprite.width}x${pack.manifest.sprite.height})`);
    }
    lines.push("");
    lines.push("Use:");
    lines.push("`claude-mascot-storybook --pack <name>`");
    lines.push("`claude-mascot-storybook --pack <name> --metrics`");
    lines.push("`claude-mascot-storybook --all-packs --states idle,thinking,done`");
    return lines.join("\n");
}
main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
//# sourceMappingURL=storybook.js.map