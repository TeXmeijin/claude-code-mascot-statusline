#!/usr/bin/env node
import { renderStatusLine } from "../lib/renderer.js";
import type { StatusLineInput } from "../lib/types.js";
import { readStdin } from "./io.js";

async function main(): Promise<void> {
  const raw = await readStdin();
  const input = raw ? (JSON.parse(raw) as StatusLineInput) : {};
  const output = await renderStatusLine(input);
  process.stdout.write(output);
}

main().catch((error: unknown) => {
  if (process.env.CLAUDE_MASCOT_DEBUG === "1") {
    console.error(error);
  }
  process.stdout.write("[-_-] mascot unavailable");
});
