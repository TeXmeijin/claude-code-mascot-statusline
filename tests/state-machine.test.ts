import { describe, expect, it } from "vitest";

import { createInitialSessionState } from "../src/lib/state.js";
import { applyHookEvent } from "../src/lib/state-machine.js";

describe("applyHookEvent", () => {
  it("starts a new turn on user prompt submit", () => {
    const initial = createInitialSessionState("session-1", new Date("2026-03-09T00:00:00.000Z"));
    const next = applyHookEvent(
      initial,
      { session_id: "session-1", hook_event_name: "UserPromptSubmit" },
      new Date("2026-03-09T00:00:01.000Z")
    );

    expect(next.currentState).toBe("thinking");
    expect(next.turnSequenceNumber).toBe(1);
    expect(next.toolCountInTurn).toBe(0);
  });

  it("tracks tool execution and failures", () => {
    let state = createInitialSessionState("session-1", new Date("2026-03-09T00:00:00.000Z"));
    state = applyHookEvent(
      state,
      { session_id: "session-1", hook_event_name: "UserPromptSubmit" },
      new Date("2026-03-09T00:00:01.000Z")
    );
    state = applyHookEvent(
      state,
      { session_id: "session-1", hook_event_name: "PreToolUse", tool_name: "Bash" },
      new Date("2026-03-09T00:00:02.000Z")
    );
    state = applyHookEvent(
      state,
      { session_id: "session-1", hook_event_name: "PostToolUseFailure", tool_name: "Bash" },
      new Date("2026-03-09T00:00:03.000Z")
    );

    expect(state.currentState).toBe("tool_failure");
    expect(state.toolCountInTurn).toBe(1);
    expect(state.failedToolCountInTurn).toBe(1);
    expect(state.lastToolName).toBe("Bash");
    expect(state.lastErrorFlag).toBe(true);
  });

  it("tracks subagent lifecycle", () => {
    let state = createInitialSessionState("session-1", new Date("2026-03-09T00:00:00.000Z"));
    state = applyHookEvent(
      state,
      { session_id: "session-1", hook_event_name: "SubagentStart", agent_type: "Explore" },
      new Date("2026-03-09T00:00:01.000Z")
    );
    expect(state.currentState).toBe("subagent_running");
    expect(state.activeSubagentCount).toBe(1);

    state = applyHookEvent(
      state,
      { session_id: "session-1", hook_event_name: "SubagentStop", agent_type: "Explore" },
      new Date("2026-03-09T00:00:02.000Z")
    );
    expect(state.currentState).toBe("thinking");
    expect(state.activeSubagentCount).toBe(0);
  });
});
