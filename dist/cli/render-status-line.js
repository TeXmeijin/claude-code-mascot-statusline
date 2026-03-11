#!/usr/bin/env node
import { renderStatusLine } from "../lib/renderer.js";
import { readStdin } from "./io.js";
async function main() {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const output = await renderStatusLine(input);
    process.stdout.write(output);
}
main().catch((error) => {
    if (process.env.CLAUDE_MASCOT_DEBUG === "1") {
        console.error(error);
    }
    process.stdout.write("[-_-] mascot unavailable");
});
//# sourceMappingURL=render-status-line.js.map