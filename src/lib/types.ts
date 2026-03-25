export const MASCOT_STATES = [
  "idle",
  "thinking",
  "tool_running",
  "tool_success",
  "tool_failure",
  "question",
  "permission",
  "subagent_running",
  "done",
  "auth_success"
] as const;

export type MascotState = (typeof MASCOT_STATES)[number];
export type PaletteColor = string | null;
export type SpriteFrame = number[][];
export type RenderMode = "bg-space" | "half-block";
export type RenderProfile = "auto" | "claude-code-safe";

export interface SessionState {
  version: 1;
  sessionId: string;
  currentState: MascotState;
  lastStateChangedAt: string;
  lastUpdatedAt: string;
  toolCountInTurn: number;
  failedToolCountInTurn: number;
  activeSubagentCount: number;
  subagentCountPeakInTurn: number;
  lastToolName: string | null;
  lastNotificationType: string | null;
  lastErrorFlag: boolean;
  turnSequenceNumber: number;
  permissionMode: string | null;
}

export interface SpriteSpec {
  width: number;
  height: number;
  palette: PaletteColor[];
  renderMode?: RenderMode;
  pixelWidth?: 1 | 2;
  offsetX?: number;
}

export interface PackTiming {
  idleFramePeriodMs?: number;
  thinkingFramePeriodMs?: number;
  toolFramePeriodMs?: number;
  doneHoldMs?: number;
  successHoldMs?: number;
  failureHoldMs?: number;
  authHoldMs?: number;
}

export interface CompactPackSection {
  sprite: SpriteSpec;
  sprites: Record<string, SpriteFrame>;
  states?: Partial<Record<MascotState, string[]>>;
  fallbacks?: {
    unknown: string;
    narrow?: string;
  };
}

export interface PackManifest {
  name: string;
  specVersion: 2;
  displayName: string;
  author?: string;
  description?: string;
  sprite: SpriteSpec;
  sprites: Record<string, SpriteFrame>;
  states: Partial<Record<MascotState, string[]>>;
  fallbacks: {
    unknown: string;
    narrow?: string;
  };
  timing?: PackTiming;
  compact?: CompactPackSection;
  meta?: Record<string, unknown>;
}

export interface LoadedPack {
  rootDir: string;
  manifestPath: string;
  manifest: PackManifest;
}

export interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  permission_mode?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_use_id?: string;
  notification_type?: string;
  stop_hook_active?: boolean;
  agent_id?: string;
  agent_type?: string;
  error?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface StatusLineInput {
  cwd?: string;
  session_id?: string;
  transcript_path?: string;
  workspace?: {
    current_dir?: string;
    project_dir?: string;
  };
  model?: {
    id?: string;
    display_name?: string;
  };
  cost?: {
    total_cost_usd?: number;
    total_duration_ms?: number;
  };
  context_window?: {
    used_percentage?: number;
  };
  output_style?: {
    name?: string;
  };
  version?: string;
}

export interface UsageData {
  fiveHour?: { utilization: number; resetsAt: string };
  sevenDay?: { utilization: number; resetsAt: string };
}

export interface UsageCacheEntry {
  fetchedAt: string;
  data: UsageData;
}

export const SUMMARY_ITEM_KEYS = [
  "project",
  "branch",
  "model",
  "tools",
  "failures",
  "subagents",
  "context",
  "usage5h",
  "usage7d"
] as const;

export type SummaryItemKey = (typeof SUMMARY_ITEM_KEYS)[number];

export interface MascotConfig {
  pack?: string;
  color?: "auto" | "always" | "never";
  twoLine?: boolean;
  compact?: boolean;
  renderProfile?: RenderProfile;
  safeBackground?: string;
  summaryItems?: SummaryItemKey[];
}

export interface RenderOptions {
  now?: Date;
  forceColor?: boolean;
  widthHint?: number | null;
  packName?: string | null;
  renderProfile?: RenderProfile;
  safeBackground?: string;
}
