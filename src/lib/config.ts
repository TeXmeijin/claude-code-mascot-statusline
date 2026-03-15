import path from "node:path";

import { DEFAULT_PACK_NAME, PROJECT_CONFIG_RELATIVE_PATH, USER_CONFIG_PATH } from "./constants.js";
import { readJsonIfExists } from "./fs.js";
import { SUMMARY_ITEM_KEYS, type MascotConfig, type SummaryItemKey } from "./types.js";

export async function loadMascotConfig(projectDir?: string): Promise<MascotConfig> {
  const projectConfigPath = projectDir ? path.join(projectDir, PROJECT_CONFIG_RELATIVE_PATH) : null;

  const [userConfig, projectConfig] = await Promise.all([
    readJsonIfExists<MascotConfig>(USER_CONFIG_PATH),
    projectConfigPath ? readJsonIfExists<MascotConfig>(projectConfigPath) : Promise.resolve(null)
  ]);

  return {
    pack: process.env.CLAUDE_MASCOT_PACK ?? projectConfig?.pack ?? userConfig?.pack ?? DEFAULT_PACK_NAME,
    color:
      normalizeColorMode(process.env.CLAUDE_MASCOT_COLOR) ??
      projectConfig?.color ??
      userConfig?.color ??
      "auto",
    twoLine:
      normalizeBoolean(process.env.CLAUDE_MASCOT_TWO_LINE) ??
      projectConfig?.twoLine ??
      userConfig?.twoLine ??
      true,
    renderProfile:
      normalizeRenderProfile(process.env.CLAUDE_MASCOT_RENDER_PROFILE) ??
      projectConfig?.renderProfile ??
      userConfig?.renderProfile ??
      "claude-code-safe",
    safeBackground:
      normalizeHexColor(process.env.CLAUDE_MASCOT_SAFE_BACKGROUND) ??
      normalizeHexColor(projectConfig?.safeBackground) ??
      normalizeHexColor(userConfig?.safeBackground) ??
      "#333333",
    summaryItems:
      normalizeSummaryItems(projectConfig?.summaryItems) ??
      normalizeSummaryItems(userConfig?.summaryItems) ??
      undefined
  };
}

function normalizeBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }
  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }
  return undefined;
}

function normalizeColorMode(value: string | undefined): MascotConfig["color"] | undefined {
  if (value === "auto" || value === "always" || value === "never") {
    return value;
  }
  return undefined;
}

function normalizeRenderProfile(value: string | undefined): MascotConfig["renderProfile"] | undefined {
  if (value === "auto" || value === "claude-code-safe") {
    return value;
  }
  return undefined;
}

function normalizeSummaryItems(value: unknown): SummaryItemKey[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const valid = value.filter((v): v is SummaryItemKey =>
    typeof v === "string" && (SUMMARY_ITEM_KEYS as readonly string[]).includes(v)
  );
  return valid.length > 0 ? valid : undefined;
}

function normalizeHexColor(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : undefined;
}
