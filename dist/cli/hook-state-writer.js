#!/usr/bin/env node
import { createInitialSessionState, readSessionState, writeSessionState } from "../lib/state.js";
import { applyHookEvent } from "../lib/state-machine.js";
import { readStdin } from "./io.js";
async function main() {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const sessionId = input.session_id;
    if (!sessionId) {
        return;
    }
    const now = new Date();
    const previous = (await readSessionState(sessionId)) ?? createInitialSessionState(sessionId, now);
    const next = applyHookEvent(previous, input, now);
    await writeSessionState(next);
}
main().catch((error) => {
    if (process.env.CLAUDE_MASCOT_DEBUG === "1") {
        console.error(error);
    }
    process.exit(0);
});
//# sourceMappingURL=hook-state-writer.js.map