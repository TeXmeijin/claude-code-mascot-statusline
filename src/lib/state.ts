import path from "node:path";

import { STATE_DIR } from "./constants.js";
import { hashId, readJsonIfExists, writeJsonAtomic } from "./fs.js";
import type { SessionState } from "./types.js";

export function createInitialSessionState(sessionId: string, now: Date): SessionState {
  const timestamp = now.toISOString();
  return {
    version: 1,
    sessionId,
    currentState: "idle",
    lastStateChangedAt: timestamp,
    lastUpdatedAt: timestamp,
    toolCountInTurn: 0,
    failedToolCountInTurn: 0,
    activeSubagentCount: 0,
    subagentCountPeakInTurn: 0,
    lastToolName: null,
    lastNotificationType: null,
    lastErrorFlag: false,
    turnSequenceNumber: 0,
    permissionMode: null
  };
}

export function getStatePath(sessionId: string): string {
  return path.join(STATE_DIR, `${hashId(sessionId)}.json`);
}

export async function readSessionState(sessionId: string): Promise<SessionState | null> {
  const state = await readJsonIfExists<SessionState>(getStatePath(sessionId));
  if (!state || state.version !== 1) {
    return null;
  }
  return state;
}

export async function writeSessionState(state: SessionState): Promise<void> {
  await writeJsonAtomic(getStatePath(state.sessionId), state);
}
