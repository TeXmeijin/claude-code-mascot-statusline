import { execFile as execFileCb } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import stringWidth from "string-width";
import stripAnsi from "strip-ansi";

import { DEFAULT_PACK_NAME } from "./constants.js";
import { loadMascotConfig } from "./config.js";
import { loadPack, loadSpriteFrame, resolveStateHoldMs } from "./pack.js";
import { readSessionState } from "./state.js";
import { getTerminalSize, getWidthHint, shouldUseColor } from "./terminal.js";
import { deriveSessionStateFromTranscript } from "./transcript.js";
import type { LoadedPack, MascotState, PaletteColor, RenderOptions, RenderProfile, SessionState, SpriteFrame, StatusLineInput, SummaryItemKey, UsageData } from "./types.js";
import { getUsageData } from "./usage.js";

const execFileAsync = promisify(execFileCb);

const HEAT_THRESHOLD = 60;
const HEAT_MAX = 85;
const HEAT_TARGET: [number, number, number] = [0xff, 0x44, 0x44];
const HEAT_PALETTE_INDEX = 2;

export function applyContextHeatPalette(
  palette: PaletteColor[],
  usedPercentage: number | undefined
): PaletteColor[] | undefined {
  if (usedPercentage === undefined || usedPercentage <= HEAT_THRESHOLD) {
    return undefined;
  }
  const t = Math.min(1, (usedPercentage - HEAT_THRESHOLD) / (HEAT_MAX - HEAT_THRESHOLD));
  const original = palette[HEAT_PALETTE_INDEX];
  if (original === null) {
    return undefined;
  }
  const [r, g, b] = hexToRgb(original);
  const nr = Math.round(r + (HEAT_TARGET[0] - r) * t);
  const ng = Math.round(g + (HEAT_TARGET[1] - g) * t);
  const nb = Math.round(b + (HEAT_TARGET[2] - b) * t);
  const newColor = `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
  const result = [...palette];
  result[HEAT_PALETTE_INDEX] = newColor;
  return result;
}

export async function renderStatusLine(input: StatusLineInput, options: RenderOptions = {}): Promise<string> {
  const now = options.now ?? new Date();
  const config = await loadMascotConfig(input.workspace?.project_dir);
  const packName = options.packName ?? config.pack ?? DEFAULT_PACK_NAME;
  const pack = await loadPack({ input, packName });
  const colorEnabled = options.forceColor ?? shouldUseColor(config.color ?? "auto");
  const widthHint = getWidthHint(options.widthHint);
  const narrow = widthHint !== null && widthHint < 72;
  const sessionId = input.session_id ?? "";
  const projectDir = input.workspace?.project_dir ?? input.cwd;
  const [persistedState, transcriptState, usageData, gitBranch] = await Promise.all([
    sessionId ? readSessionState(sessionId) : Promise.resolve(null),
    deriveSessionStateFromTranscript(input.transcript_path, now),
    getUsageData().catch(() => undefined),
    getGitBranch(projectDir).catch(() => undefined)
  ]);
  const sessionState = selectMostRecentState(persistedState, transcriptState);
  const effectiveState = resolveEffectiveState(sessionState, pack, now);
  const sprite = loadSpriteFrame(pack, effectiveState, {
    narrow,
    now,
    stateChangedAt: sessionState?.lastStateChangedAt
  });
  const heatSource = input.context_window?.used_percentage || undefined;
  const heatPalette = applyContextHeatPalette(
    pack.manifest.sprite.palette,
    heatSource
  );
  const art = renderSprite(pack, sprite, {
    colorEnabled,
    narrow,
    renderProfile: options.renderProfile ?? config.renderProfile ?? "auto",
    safeBackground: options.safeBackground ?? config.safeBackground ?? "#000000",
    paletteOverride: heatPalette
  });
  const { base, extras } = summarizeState(effectiveState, sessionState, input, usageData, gitBranch, colorEnabled, projectDir, config.summaryItems);

  if (config.twoLine) {
    // Keep each line under statusLine available width to prevent cli-truncate
    // from eating sprite lines. Claude Code uses row layout at cols >= 80,
    // giving statusLine ≈ cols/2 - padding. Use cols - 10 as buffer.
    const termSize = getTerminalSize();
    const maxLineWidth = termSize ? termSize.cols - 18 : 55;

    // Wrap summary parts within maxLineWidth
    const allParts = [base, ...extras];
    const summaryLines: string[] = [];
    let current = "";
    for (const part of allParts) {
      const candidate = current ? `${current} | ${part}` : part;
      if (stringWidth(stripAnsi(candidate)) > maxLineWidth && current) {
        summaryLines.push(current);
        current = part;
      } else {
        current = candidate;
      }
    }
    if (current) summaryLines.push(current);
    const wrappedSummary = summaryLines.map(l => truncate(l, maxLineWidth)).join("\n");
    return `${art}\n${wrappedSummary}`;
  }

  const compactArt = art
    .replaceAll("\n", " ")
    .replaceAll(/\s+/g, " ")
    .trim();

  return truncate(`${compactArt} ${[base, ...extras].join(" | ")}`.trim(), widthHint);
}

export function renderSprite(
  pack: LoadedPack,
  sprite: SpriteFrame,
  options: {
    colorEnabled: boolean;
    narrow: boolean;
    renderProfile?: RenderProfile;
    safeBackground?: string;
    paletteOverride?: PaletteColor[];
  }
): string {
  const palette = options.paletteOverride ?? pack.manifest.sprite.palette;
  const renderMode = pack.manifest.sprite.renderMode ?? "bg-space";
  const offsetX = Math.max(0, pack.manifest.sprite.offsetX ?? 0);
  const renderProfile = options.renderProfile ?? "auto";
  if (renderMode === "half-block" && renderProfile === "claude-code-safe") {
    return applyHorizontalOffset(
      renderHalfBlockSpriteSafe(
        centerHalfBlockSprite(sprite),
        palette,
        options.colorEnabled,
        options.safeBackground ?? "#000000"
      ),
      offsetX
    );
  }

  if (renderMode === "half-block") {
    return applyHorizontalOffset(
      renderHalfBlockSprite(centerHalfBlockSprite(sprite), palette, options.colorEnabled),
      offsetX
    );
  }

  const pixelWidth = options.narrow ? 1 : pack.manifest.sprite.pixelWidth ?? 2;
  return applyHorizontalOffset(
    renderBgSpaceSprite(sprite, palette, {
      colorEnabled: options.colorEnabled,
      pixelWidth
    }),
    offsetX * pixelWidth
  );
}

export function summarizeState(
  state: MascotState,
  sessionState: SessionState | null,
  input: StatusLineInput,
  usageData?: UsageData,
  gitBranch?: string,
  colorEnabled?: boolean,
  projectDir?: string,
  summaryItems?: SummaryItemKey[]
): { base: string; extras: string[]; full: string } {
  const show = (key: SummaryItemKey) => !summaryItems || summaryItems.includes(key);

  const toolName = sessionState?.lastToolName
    ? sessionState.lastToolName.length > 15
      ? `${sessionState.lastToolName.slice(0, 15)}…`
      : sessionState.lastToolName
    : undefined;

  const base = (() => {
    switch (state) {
      case "idle":
        return "waiting";
      case "thinking":
        return sessionState && sessionState.toolCountInTurn > 0
          ? `thinking x${sessionState.toolCountInTurn}`
          : "thinking";
      case "tool_running":
        return toolName ? `running ${toolName}` : "running tool";
      case "tool_success":
        return toolName ? `${toolName} ok` : "tool ok";
      case "tool_failure":
        return toolName ? `${toolName} failed` : "tool failed";
      case "question":
        return "needs input";
      case "permission":
        return "permission needed";
      case "subagent_running":
        return sessionState?.activeSubagentCount
          ? `subagent x${sessionState.activeSubagentCount}`
          : "subagent active";
      case "done":
        return "done";
      case "auth_success":
        return "auth ok";
    }
  })();

  const extras: string[] = [];
  if (show("project") && projectDir) {
    const dirName = path.basename(projectDir);
    extras.push(dirName.length > 20 ? `${dirName.slice(0, 20)}…` : dirName);
  }
  if (show("branch") && gitBranch) {
    extras.push(`⎇ ${gitBranch}`);
  }
  if (show("model")) {
    const modelLabel = input.model?.display_name ?? input.model?.id;
    if (modelLabel) {
      extras.push(modelLabel);
    }
  }
  if (show("tools") && sessionState?.toolCountInTurn) {
    extras.push(`tools:${sessionState.toolCountInTurn}`);
  }
  if (show("failures") && sessionState?.failedToolCountInTurn) {
    extras.push(`fail:${sessionState.failedToolCountInTurn}`);
  }
  if (show("subagents") && sessionState?.activeSubagentCount) {
    extras.push(`sub:${sessionState.activeSubagentCount}`);
  }
  if (show("context") && typeof input.context_window?.used_percentage === "number") {
    extras.push(`ctx:${Math.round(input.context_window.used_percentage)}%`);
  }
  if (show("usage5h") && usageData?.fiveHour) {
    const text = `5h:${Math.round(usageData.fiveHour.utilization)}%${formatResetTime(usageData.fiveHour.resetsAt)}`;
    extras.push(colorizeByHeat(text, usageData.fiveHour.utilization, colorEnabled));
  }
  if (show("usage7d") && usageData?.sevenDay) {
    const text = `7w:${Math.round(usageData.sevenDay.utilization)}%${formatResetTime(usageData.sevenDay.resetsAt)}`;
    extras.push(colorizeByHeat(text, usageData.sevenDay.utilization, colorEnabled));
  }

  return { base, extras, full: [base, ...extras].join(" | ") };
}

function formatResetTime(resetsAt: string): string {
  const resetDate = new Date(resetsAt);
  if (Number.isNaN(resetDate.getTime())) {
    return "";
  }
  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();
  if (diffMs <= 0) {
    return "";
  }
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffH > 24) {
    const hours = resetDate.getHours();
    const ampm = hours >= 12 ? "pm" : "am";
    const h12 = hours % 12 || 12;
    return `(${resetDate.getMonth() + 1}/${resetDate.getDate()} ${h12}${ampm})`;
  }
  if (diffH > 0) {
    return `(${diffH}h${diffM}m)`;
  }
  return `(${diffM}m)`;
}

function resolveEffectiveState(sessionState: SessionState | null, pack: LoadedPack, now: Date): MascotState {
  if (!sessionState) {
    return "idle";
  }

  const holdMs = resolveStateHoldMs(pack, sessionState.currentState);
  if (!holdMs) {
    return sessionState.currentState;
  }

  const elapsedMs = now.getTime() - Date.parse(sessionState.lastStateChangedAt);
  if (elapsedMs < holdMs) {
    return sessionState.currentState;
  }

  if (sessionState.activeSubagentCount > 0) {
    return "subagent_running";
  }
  if (
    sessionState.currentState === "done" ||
    sessionState.currentState === "tool_success" ||
    sessionState.currentState === "tool_failure" ||
    sessionState.currentState === "auth_success"
  ) {
    return "idle";
  }
  if (sessionState.currentState === "question" || sessionState.currentState === "permission") {
    return "thinking";
  }
  if (sessionState.turnSequenceNumber > 0 && sessionState.currentState === "thinking") {
    return "thinking";
  }
  return "idle";
}

function selectMostRecentState(
  persistedState: SessionState | null,
  transcriptState: SessionState | null
): SessionState | null {
  if (!persistedState) {
    return transcriptState;
  }
  if (!transcriptState) {
    return persistedState;
  }

  return Date.parse(transcriptState.lastUpdatedAt) >= Date.parse(persistedState.lastUpdatedAt)
    ? transcriptState
    : persistedState;
}

function renderBgSpaceSprite(
  sprite: SpriteFrame,
  palette: PaletteColor[],
  options: {
    colorEnabled: boolean;
    pixelWidth: number;
    transparentColor?: string;
  }
): string {
  const transparentCell = " ".repeat(options.pixelWidth);
  return sprite
    .map((row) =>
      row
        .map((pixelIndex) => {
          const color = palette[pixelIndex] ?? null;
          if (color === null) {
            if (options.colorEnabled && options.transparentColor) {
              return `${bgColor(options.transparentColor)}${transparentCell}${resetColor()}`;
            }
            return transparentCell;
          }
          if (!options.colorEnabled) {
            return "█".repeat(options.pixelWidth);
          }
          return `${bgColor(color)}${transparentCell}${resetColor()}`;
        })
        .join("")
    )
    .join("\n");
}

function renderHalfBlockSprite(sprite: SpriteFrame, palette: PaletteColor[], colorEnabled: boolean): string {
  const rows: string[] = [];
  for (let rowIndex = 0; rowIndex < sprite.length; rowIndex += 2) {
    const top = sprite[rowIndex] ?? [];
    const bottom = sprite[rowIndex + 1] ?? new Array<number>(top.length).fill(0);
    let line = "";

    for (let column = 0; column < top.length; column += 1) {
      const topColor = palette[top[column] ?? 0] ?? null;
      const bottomColor = palette[bottom[column] ?? 0] ?? null;
      line += renderHalfBlockCell(topColor, bottomColor, colorEnabled);
    }

    rows.push(line);
  }
  return rows.join("\n");
}

function renderCoalescedBgSprite(
  sprite: SpriteFrame,
  palette: PaletteColor[],
  options: {
    colorEnabled: boolean;
    pixelWidth: number;
    transparentColor?: string;
  }
): string {
  const merged: SpriteFrame = [];
  for (let rowIndex = 0; rowIndex < sprite.length; rowIndex += 2) {
    const top = sprite[rowIndex] ?? [];
    const bottom = sprite[rowIndex + 1] ?? top;
    const row = top.map((_, column) => chooseMergedPixel(top[column] ?? 0, bottom[column] ?? 0, palette));
    merged.push(row);
  }

  return renderBgSpaceSprite(merged, palette, options);
}

function renderHalfBlockSpriteSafe(
  sprite: SpriteFrame,
  palette: PaletteColor[],
  colorEnabled: boolean,
  safeBackground: string
): string {
  const rows: string[] = [];
  for (let rowIndex = 0; rowIndex < sprite.length; rowIndex += 2) {
    const top = sprite[rowIndex] ?? [];
    const bottom = sprite[rowIndex + 1] ?? new Array<number>(top.length).fill(0);
    let line = "";

    for (let column = 0; column < top.length; column += 1) {
      const topColor = palette[top[column] ?? 0] ?? null;
      const bottomColor = palette[bottom[column] ?? 0] ?? null;
      line += renderHalfBlockSafeCell(topColor, bottomColor, colorEnabled, safeBackground);
    }

    rows.push(line);
  }
  return rows.join("\n");
}

function chooseMergedPixel(topIndex: number, bottomIndex: number, palette: PaletteColor[]): number {
  const top = palette[topIndex] ?? null;
  const bottom = palette[bottomIndex] ?? null;
  if (top === null && bottom === null) {
    return 0;
  }
  if (top === null) {
    return bottomIndex;
  }
  if (bottom === null) {
    return topIndex;
  }
  if (top === bottom) {
    return topIndex;
  }
  return bottomIndex;
}

function applyHorizontalOffset(rendered: string, width: number): string {
  if (width <= 0) {
    return rendered;
  }
  const padding = " ".repeat(width);
  return rendered
    .split("\n")
    .map((line) => `${padding}${line}`)
    .join("\n");
}

function centerHalfBlockSprite(sprite: SpriteFrame): SpriteFrame {
  const width = sprite[0]?.length ?? 0;
  if (width === 0) {
    return sprite;
  }

  let globalFirst = width;
  let globalLast = -1;

  for (let rowIndex = 0; rowIndex < sprite.length; rowIndex += 1) {
    const row = sprite[rowIndex] ?? [];
    for (let column = 0; column < width; column += 1) {
      if ((row[column] ?? 0) !== 0) {
        globalFirst = Math.min(globalFirst, column);
        globalLast = Math.max(globalLast, column);
      }
    }
  }

  if (globalLast === -1) {
    return sprite;
  }

  const targetCenter = (width - 1) / 2;
  const visibleCenter = (globalFirst + globalLast) / 2;
  const shift = Math.round(targetCenter - visibleCenter);
  if (shift === 0) {
    return sprite;
  }

  return sprite.map((row) => shiftSpriteRow([...row], shift, width));
}

function shiftSpriteRow(row: number[], shift: number, width: number): number[] {
  const shifted = new Array<number>(width).fill(0);
  for (let column = 0; column < width; column += 1) {
    const sourceColumn = column - shift;
    if (sourceColumn < 0 || sourceColumn >= width) {
      continue;
    }
    shifted[column] = row[sourceColumn] ?? 0;
  }
  return shifted;
}

function renderHalfBlockCell(top: PaletteColor, bottom: PaletteColor, colorEnabled: boolean): string {
  if (!colorEnabled) {
    if (top === null && bottom === null) {
      return " ";
    }
    if (top !== null && bottom !== null) {
      return "█";
    }
    return top !== null ? "▀" : "▄";
  }

  if (top === null && bottom === null) {
    return " ";
  }
  if (top !== null && bottom !== null) {
    if (top === bottom) {
      return `${fgColor(top)}█${resetColor()}`;
    }
    return `${fgColor(top)}${bgColor(bottom)}▀${resetColor()}`;
  }
  if (top !== null) {
    return `${fgColor(top)}▀${resetColor()}`;
  }
  return `${fgColor(bottom!)}▄${resetColor()}`;
}

function renderHalfBlockSafeCell(
  top: PaletteColor,
  bottom: PaletteColor,
  colorEnabled: boolean,
  safeBackground: string
): string {
  if (top === null && bottom === null) {
    if (!colorEnabled) {
      return " ";
    }
    return `${bgColor(safeBackground)}\u00a0${resetColor()}`;
  }
  return renderHalfBlockCell(top, bottom, colorEnabled);
}

function fgColor(color: string): string {
  const [r, g, b] = hexToRgb(color);
  return `\u001b[38;2;${r};${g};${b}m`;
}

function bgColor(color: string): string {
  const [r, g, b] = hexToRgb(color);
  return `\u001b[48;2;${r};${g};${b}m`;
}

function resetColor(): string {
  return "\u001b[0m";
}

function hexToRgb(color: string): [number, number, number] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16)
  ];
}

function colorizeByHeat(text: string, percentage: number, colorEnabled?: boolean): string {
  if (!colorEnabled || percentage <= HEAT_THRESHOLD) {
    return text;
  }
  const t = Math.min(1, (percentage - HEAT_THRESHOLD) / (HEAT_MAX - HEAT_THRESHOLD));
  const r = Math.round(0xcc + (HEAT_TARGET[0] - 0xcc) * t);
  const g = Math.round(0xcc - 0xcc * t);
  const b = Math.round(0xcc - (0xcc - HEAT_TARGET[2]) * t);
  return `\u001b[38;2;${r};${g};${b}m${text}${resetColor()}`;
}

function truncate(value: string, widthHint: number | null): string {
  if (widthHint === null) {
    return value;
  }
  const width = stringWidth(stripAnsi(value));
  if (width <= widthHint) {
    return value;
  }
  const suffix = " ...";
  const targetWidth = Math.max(1, widthHint - stringWidth(suffix));
  let output = "";
  for (const character of value) {
    if (stringWidth(stripAnsi(output + character)) > targetWidth) {
      break;
    }
    output += character;
  }
  return `${output}${suffix}`;
}

async function getGitBranch(cwd?: string): Promise<string | undefined> {
  if (!cwd) return undefined;
  const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd,
    timeout: 1000
  });
  const branch = stdout.trim();
  return branch || undefined;
}
