import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { APP_HOME, USAGE_CACHE_TTL_MS, USAGE_FETCH_TIMEOUT_MS } from "./constants.js";
import { readJsonIfExists, writeJsonAtomic } from "./fs.js";
import type { UsageCacheEntry, UsageData } from "./types.js";

const USAGE_API_URL = "https://api.anthropic.com/api/oauth/usage";
const LOCK_COOLDOWN_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000;

function getClaudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude");
}

function getConfigSuffix(): string | null {
  const configDir = getClaudeConfigDir();
  const defaultDir = path.join(os.homedir(), ".claude");
  if (configDir === defaultDir) {
    return null;
  }
  return crypto.createHash("sha256").update(configDir).digest("hex").slice(0, 8);
}

function getUsageCachePath(): string {
  const suffix = getConfigSuffix();
  return path.join(APP_HOME, suffix ? `usage-cache-${suffix}.json` : "usage-cache.json");
}

function getUsageLockPath(): string {
  return `${getUsageCachePath()}.lock`;
}

function getKeychainServiceName(): string {
  const suffix = getConfigSuffix();
  return suffix ? `Claude Code-credentials-${suffix}` : "Claude Code-credentials";
}

async function getOAuthTokenFromKeychain(): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(
      "security",
      ["find-generic-password", "-s", getKeychainServiceName(), "-w"],
      { timeout: 2000 },
      (error, stdout) => {
        if (error || !stdout) {
          resolve(undefined);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim()) as { claudeAiOauth?: { accessToken?: string } };
          resolve(parsed.claudeAiOauth?.accessToken ?? undefined);
        } catch {
          resolve(undefined);
        }
      }
    );
  });
}

async function getOAuthTokenFromFile(): Promise<string | undefined> {
  try {
    const credPath = path.join(getClaudeConfigDir(), ".credentials.json");
    const raw = await fs.readFile(credPath, "utf8");
    const parsed = JSON.parse(raw) as { claudeAiOauth?: { accessToken?: string } };
    return parsed.claudeAiOauth?.accessToken ?? undefined;
  } catch {
    return undefined;
  }
}

async function getOAuthToken(): Promise<string | undefined> {
  if (process.platform === "darwin") {
    return getOAuthTokenFromKeychain();
  }
  return getOAuthTokenFromFile();
}

async function writeLock(backoffMs: number = LOCK_COOLDOWN_MS): Promise<void> {
  try {
    const lockPath = getUsageLockPath();
    const blockedUntil = Date.now() + backoffMs;
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(lockPath, JSON.stringify({ blockedUntil }), "utf8");
  } catch {
    // ignore
  }
}

async function isLockedUntil(): Promise<boolean> {
  try {
    const raw = await fs.readFile(getUsageLockPath(), "utf8");
    const parsed = JSON.parse(raw) as { blockedUntil?: number };
    return typeof parsed.blockedUntil === "number" && parsed.blockedUntil > Date.now();
  } catch {
    return false;
  }
}

interface ApiResponse {
  five_hour?: { utilization?: number; resets_at?: string };
  seven_day?: { utilization?: number; resets_at?: string };
}

function parseUsageData(body: ApiResponse): UsageData | undefined {
  const data: UsageData = {};
  if (typeof body.five_hour?.utilization === "number" && typeof body.five_hour?.resets_at === "string") {
    data.fiveHour = { utilization: body.five_hour.utilization, resetsAt: body.five_hour.resets_at };
  }
  if (typeof body.seven_day?.utilization === "number" && typeof body.seven_day?.resets_at === "string") {
    data.sevenDay = { utilization: body.seven_day.utilization, resetsAt: body.seven_day.resets_at };
  }
  return data.fiveHour || data.sevenDay ? data : undefined;
}

async function fetchUsageFromApi(token: string): Promise<UsageData | "rate-limited" | undefined> {
  const response = await fetch(USAGE_API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20"
    },
    signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS)
  });

  if (response.status === 429) {
    return "rate-limited";
  }

  if (!response.ok) {
    return undefined;
  }

  return parseUsageData((await response.json()) as ApiResponse);
}

function isValidCache(cached: UsageCacheEntry | null): cached is UsageCacheEntry {
  return cached !== null && typeof cached.fetchedAt === "string" && cached.data !== undefined;
}

export async function getUsageData(): Promise<UsageData | undefined> {
  try {
    const cachePath = getUsageCachePath();
    const cached = await readJsonIfExists<UsageCacheEntry>(cachePath);
    if (isValidCache(cached)) {
      const age = Date.now() - Date.parse(cached.fetchedAt);
      if (age < USAGE_CACHE_TTL_MS) {
        return cached.data;
      }
    }

    if (await isLockedUntil()) {
      return isValidCache(cached) ? cached.data : undefined;
    }

    const token = await getOAuthToken();
    if (!token) {
      return undefined;
    }

    await writeLock();

    const result = await fetchUsageFromApi(token);

    if (result === "rate-limited") {
      await writeLock(RATE_LIMIT_BACKOFF_MS);
      return isValidCache(cached) ? cached.data : undefined;
    }

    if (result === undefined) {
      return isValidCache(cached) ? cached.data : undefined;
    }

    const entry: UsageCacheEntry = {
      fetchedAt: new Date().toISOString(),
      data: result
    };
    writeJsonAtomic(cachePath, entry).catch(() => {});

    return result;
  } catch {
    return undefined;
  }
}
