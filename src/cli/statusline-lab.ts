#!/usr/bin/env node
import { loadPack, resolveSpriteName } from "../lib/pack.js";
import { renderSprite, summarizeState } from "../lib/renderer.js";
import { analyzeSpriteFrame, formatVisualLint } from "../lib/visual-lint.js";
import { MASCOT_STATES, type MascotState, type RenderProfile, type SessionState } from "../lib/types.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const pack = await loadPack({ packName: args.pack, cwd: process.cwd() });
  const sections: string[] = [];

  for (const profile of args.profiles) {
    sections.push(`Profile: ${profile}`);

    for (const state of args.states) {
      const spriteName = resolveSpriteName(pack.manifest, state, {
        narrow: args.width !== null && args.width < 72,
        now: args.now,
        stateChangedAt: args.now.toISOString()
      });
      const sprite = pack.manifest.sprites[spriteName];
      const sessionState = createSyntheticSessionState(state, args.now);
      const summary = summarizeState(state, sessionState, {
        context_window: {
          used_percentage: 22
        }
      });

      sections.push(`State: ${state}`);
      sections.push(`Sprite: ${spriteName}`);
      sections.push(
        renderSprite(pack, sprite, {
          colorEnabled: args.color === "always",
          narrow: args.width !== null && args.width < 72,
          renderProfile: profile
        })
      );
      sections.push(`Summary: ${summary}`);
      sections.push(...formatVisualLint(analyzeSpriteFrame(sprite)));
    }
  }

  process.stdout.write(sections.join("\n\n"));
  process.stdout.write("\n");
}

function parseArgs(argv: string[]): {
  pack: string | null;
  states: MascotState[];
  profiles: RenderProfile[];
  color: "always" | "never";
  width: number | null;
  now: Date;
} {
  const flags = new Map<string, string>();

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
  }

  const states = (flags.get("states") ?? "idle,thinking,tool_running,done")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is MascotState => MASCOT_STATES.includes(value as MascotState));

  const profiles = (flags.get("profiles") ?? "auto,claude-code-safe")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is RenderProfile => value === "auto" || value === "claude-code-safe");

  return {
    pack: flags.get("pack") ?? null,
    states,
    profiles,
    color: flags.get("color") === "never" ? "never" : "always",
    width: flags.get("width") ? Number.parseInt(flags.get("width")!, 10) : 96,
    now: new Date(flags.get("now") ?? "2026-03-09T12:00:00.000Z")
  };
}

function createSyntheticSessionState(state: MascotState, now: Date): SessionState {
  const base: SessionState = {
    version: 1,
    sessionId: "lab",
    currentState: state,
    lastStateChangedAt: now.toISOString(),
    lastUpdatedAt: now.toISOString(),
    toolCountInTurn: state === "thinking" || state === "tool_running" ? 3 : 0,
    failedToolCountInTurn: state === "tool_failure" ? 1 : 0,
    activeSubagentCount: state === "subagent_running" ? 1 : 0,
    subagentCountPeakInTurn: state === "subagent_running" ? 1 : 0,
    lastToolName: state === "tool_running" ? "Bash" : null,
    lastNotificationType: null,
    lastErrorFlag: state === "tool_failure",
    turnSequenceNumber: 1,
    permissionMode: null
  };

  if (state === "permission") {
    base.lastNotificationType = "permission_prompt";
  }
  if (state === "question") {
    base.lastNotificationType = "elicitation_dialog";
  }
  if (state === "tool_success") {
    base.lastToolName = "Read";
    base.toolCountInTurn = 3;
  }
  if (state === "tool_failure") {
    base.lastToolName = "Bash";
    base.toolCountInTurn = 3;
  }

  return base;
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
