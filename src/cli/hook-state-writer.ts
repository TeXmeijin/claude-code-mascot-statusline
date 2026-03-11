#!/usr/bin/env node
import { createInitialSessionState, readSessionState, writeSessionState } from "../lib/state.js";
import { applyHookEvent } from "../lib/state-machine.js";
import type { HookInput } from "../lib/types.js";
import { readStdin } from "./io.js";

async function main(): Promise<void> {
  const raw = await readStdin();
  const input = raw ? (JSON.parse(raw) as HookInput) : {};
  const sessionId = input.session_id;

  if (!sessionId) {
    return;
  }

  const now = new Date();
  const previous = (await readSessionState(sessionId)) ?? createInitialSessionState(sessionId, now);
  const next = applyHookEvent(previous, input, now);
  await writeSessionState(next);
}

main().catch((error: unknown) => {
  if (process.env.CLAUDE_MASCOT_DEBUG === "1") {
    console.error(error);
  }
  process.exit(0);
});
