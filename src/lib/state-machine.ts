import type { HookInput, SessionState } from "./types.js";

function setState(state: SessionState, nextState: SessionState["currentState"], now: Date): SessionState {
  if (state.currentState === nextState) {
    return {
      ...state,
      lastUpdatedAt: now.toISOString()
    };
  }

  const timestamp = now.toISOString();
  return {
    ...state,
    currentState: nextState,
    lastStateChangedAt: timestamp,
    lastUpdatedAt: timestamp
  };
}

export function applyHookEvent(previous: SessionState, input: HookInput, now: Date): SessionState {
  let state: SessionState = {
    ...previous,
    lastUpdatedAt: now.toISOString(),
    permissionMode: input.permission_mode ?? previous.permissionMode
  };

  switch (input.hook_event_name) {
    case "SessionStart":
      return setState(
        {
          ...state,
          toolCountInTurn: 0,
          failedToolCountInTurn: 0,
          activeSubagentCount: 0,
          subagentCountPeakInTurn: 0,
          lastToolName: null,
          lastNotificationType: null,
          lastErrorFlag: false
        },
        "idle",
        now
      );
    case "UserPromptSubmit":
      return setState(
        {
          ...state,
          toolCountInTurn: 0,
          failedToolCountInTurn: 0,
          activeSubagentCount: 0,
          subagentCountPeakInTurn: 0,
          lastToolName: null,
          lastNotificationType: null,
          lastErrorFlag: false,
          turnSequenceNumber: state.turnSequenceNumber + 1
        },
        "thinking",
        now
      );
    case "PreToolUse":
      return setState(
        {
          ...state,
          toolCountInTurn: state.toolCountInTurn + 1,
          lastToolName: input.tool_name ?? previous.lastToolName
        },
        "tool_running",
        now
      );
    case "PermissionRequest":
      return setState(
        {
          ...state,
          lastToolName: input.tool_name ?? previous.lastToolName
        },
        "permission",
        now
      );
    case "PostToolUse":
      return setState(
        {
          ...state,
          lastToolName: input.tool_name ?? previous.lastToolName,
          lastErrorFlag: false
        },
        "tool_success",
        now
      );
    case "PostToolUseFailure":
      return setState(
        {
          ...state,
          failedToolCountInTurn: state.failedToolCountInTurn + 1,
          lastToolName: input.tool_name ?? previous.lastToolName,
          lastErrorFlag: true
        },
        "tool_failure",
        now
      );
    case "Notification":
      return applyNotification(state, input.notification_type, now);
    case "SubagentStart": {
      const activeSubagentCount = state.activeSubagentCount + 1;
      return setState(
        {
          ...state,
          activeSubagentCount,
          subagentCountPeakInTurn: Math.max(activeSubagentCount, state.subagentCountPeakInTurn)
        },
        "subagent_running",
        now
      );
    }
    case "SubagentStop": {
      const activeSubagentCount = Math.max(0, state.activeSubagentCount - 1);
      return setState(
        {
          ...state,
          activeSubagentCount
        },
        activeSubagentCount > 0 ? "subagent_running" : "thinking",
        now
      );
    }
    case "Stop":
      return setState(state, "done", now);
    case "SessionEnd":
      return setState(state, "idle", now);
    default:
      return state;
  }
}

function applyNotification(
  state: SessionState,
  notificationType: string | undefined,
  now: Date
): SessionState {
  const nextState = (() => {
    switch (notificationType) {
      case "permission_prompt":
        return "permission";
      case "elicitation_dialog":
        return "question";
      case "auth_success":
        return "auth_success";
      case "idle_prompt":
        return "idle";
      default:
        return state.currentState;
    }
  })();

  return setState(
    {
      ...state,
      lastNotificationType: notificationType ?? state.lastNotificationType
    },
    nextState,
    now
  );
}
