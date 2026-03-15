export function shouldUseColor(mode: "auto" | "always" | "never"): boolean {
  if (mode === "always") {
    return true;
  }
  if (mode === "never") {
    return false;
  }
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.CLAUDE_MASCOT_FORCE_COLOR === "1") {
    return true;
  }
  if (process.env.TERM === "dumb") {
    return false;
  }
  return true;
}

export function getWidthHint(explicitWidth?: number | null): number | null {
  if (typeof explicitWidth === "number" && Number.isFinite(explicitWidth) && explicitWidth > 0) {
    return explicitWidth;
  }

  const candidates = [process.env.CLAUDE_MASCOT_WIDTH_HINT, process.env.COLUMNS];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const parsed = Number.parseInt(candidate, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return process.stdout.isTTY ? process.stdout.columns : null;
}

import { execSync } from "node:child_process";

let cachedTerminalSize: { cols: number; rows: number; fetchedAt: number } | null = null;
const TERMINAL_SIZE_TTL_MS = 5000;

export function getTerminalSize(): { cols: number; rows: number } | null {
  if (cachedTerminalSize && Date.now() - cachedTerminalSize.fetchedAt < TERMINAL_SIZE_TTL_MS) {
    return { cols: cachedTerminalSize.cols, rows: cachedTerminalSize.rows };
  }

  // Try process.stdout first (works when TTY is attached)
  if (process.stdout.isTTY && process.stdout.columns) {
    cachedTerminalSize = { cols: process.stdout.columns, rows: process.stdout.rows ?? 24, fetchedAt: Date.now() };
    return { cols: cachedTerminalSize.cols, rows: cachedTerminalSize.rows };
  }

  // Parent process TTY approach (works in piped child processes)
  try {
    const tty = execSync("ps -o tty= -p $(ps -o ppid= -p $$)", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      shell: "/bin/sh",
      timeout: 2000
    }).trim();
    if (tty && tty !== "??" && tty !== "?") {
      const size = execSync(`stty size < /dev/${tty}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
        shell: "/bin/sh",
        timeout: 2000
      }).trim();
      const [rows, cols] = size.split(" ").map(Number);
      if (Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0) {
        cachedTerminalSize = { cols, rows, fetchedAt: Date.now() };
        return { cols, rows };
      }
    }
  } catch {
    // Silently fall back
  }

  return null;
}

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
