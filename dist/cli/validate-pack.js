#!/usr/bin/env node
import path from "node:path";
import { validatePackDirectory } from "../lib/pack.js";
async function main() {
    const target = process.argv[2];
    if (!target) {
        throw new Error("Usage: claude-mascot-validate-pack <pack-dir>");
    }
    const pack = await validatePackDirectory(path.resolve(target));
    process.stdout.write(`OK ${pack.manifest.displayName} (${pack.manifest.name})\n`);
}
main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
//# sourceMappingURL=validate-pack.js.map