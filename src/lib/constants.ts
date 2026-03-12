import os from "node:os";
import path from "node:path";

export function getClaudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude");
}

export const APP_HOME = process.env.CLAUDE_MASCOT_HOME
  ? path.resolve(process.env.CLAUDE_MASCOT_HOME)
  : path.join(getClaudeConfigDir(), "plugins", "claude-code-mascot-statusline");
export const STATE_DIR = path.join(APP_HOME, "state");
export const USER_PACKS_DIR = path.join(APP_HOME, "packs");
export const USER_CONFIG_PATH = path.join(APP_HOME, "config.json");
export const PROJECT_CONFIG_RELATIVE_PATH = path.join(".claude", "mascot.json");
export const PROJECT_PACKS_RELATIVE_PATH = path.join(".claude", "mascot-packs");
export const DEFAULT_PACK_NAME = "pixel-buddy";

export const USAGE_CACHE_TTL_MS = 6 * 60 * 1000;
export const USAGE_FETCH_TIMEOUT_MS = 3000;

export const DEFAULT_TIMINGS = {
  idleFramePeriodMs: 1200,
  thinkingFramePeriodMs: 350,
  toolFramePeriodMs: 250,
  doneHoldMs: 2500,
  successHoldMs: 1200,
  failureHoldMs: 1800,
  authHoldMs: 1500
} as const;
