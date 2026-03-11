#!/usr/bin/env node
import path from "node:path";
import { getSpriteNamesForState, loadPack, validatePackDirectory } from "../lib/pack.js";
import { renderSprite } from "../lib/renderer.js";
async function main() {
    const args = new Map();
    for (let index = 2; index < process.argv.length; index += 2) {
        const key = process.argv[index];
        const value = process.argv[index + 1];
        if (key?.startsWith("--") && value) {
            args.set(key.slice(2), value);
        }
    }
    const state = (args.get("state") ?? "idle");
    const frames = Number.parseInt(args.get("frames") ?? "3", 10);
    const widthHint = args.get("width") ? Number.parseInt(args.get("width"), 10) : null;
    const colorEnabled = args.get("color") !== "never";
    const pack = args.has("dir")
        ? await validatePackDirectory(path.resolve(args.get("dir")))
        : await loadPack({ packName: args.get("pack") ?? undefined, cwd: process.cwd() });
    const narrow = widthHint !== null && widthHint < 72;
    const spriteNames = getSpriteNamesForState(pack, state, narrow).slice(0, frames);
    spriteNames.forEach((spriteName, index) => {
        const sprite = pack.manifest.sprites[spriteName];
        process.stdout.write(renderSprite(pack, sprite, {
            colorEnabled,
            narrow
        }));
        process.stdout.write(index === spriteNames.length - 1 ? "\n" : "\n\n");
    });
}
main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
//# sourceMappingURL=preview-pack.js.map