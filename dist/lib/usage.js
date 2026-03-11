import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { APP_HOME, getClaudeConfigDir, USAGE_CACHE_TTL_MS, USAGE_FETCH_TIMEOUT_MS } from "./constants.js";
import { readJsonIfExists, writeJsonAtomic } from "./fs.js";
const USAGE_API_URL = "https://api.anthropic.com/api/oauth/usage";
const LOCK_COOLDOWN_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000;
function getUsageCachePath() {
    return path.join(APP_HOME, "usage-cache.json");
}
function getUsageLockPath() {
    return `${getUsageCachePath()}.lock`;
}
function getKeychainServiceName() {
    const configDir = getClaudeConfigDir();
    const defaultDir = path.join(os.homedir(), ".claude");
    if (configDir === defaultDir) {
        return "Claude Code-credentials";
    }
    const suffix = crypto.createHash("sha256").update(configDir).digest("hex").slice(0, 8);
    return `Claude Code-credentials-${suffix}`;
}
async function getOAuthTokenFromKeychain() {
    return new Promise((resolve) => {
        execFile("security", ["find-generic-password", "-s", getKeychainServiceName(), "-w"], { timeout: 2000 }, (error, stdout) => {
            if (error || !stdout) {
                resolve(undefined);
                return;
            }
            try {
                const parsed = JSON.parse(stdout.trim());
                resolve(parsed.claudeAiOauth?.accessToken ?? undefined);
            }
            catch {
                resolve(undefined);
            }
        });
    });
}
async function getOAuthTokenFromFile() {
    try {
        const credPath = path.join(getClaudeConfigDir(), ".credentials.json");
        const raw = await fs.readFile(credPath, "utf8");
        const parsed = JSON.parse(raw);
        return parsed.claudeAiOauth?.accessToken ?? undefined;
    }
    catch {
        return undefined;
    }
}
async function getOAuthToken() {
    if (process.platform === "darwin") {
        return getOAuthTokenFromKeychain();
    }
    return getOAuthTokenFromFile();
}
async function writeLock(backoffMs = LOCK_COOLDOWN_MS) {
    try {
        const lockPath = getUsageLockPath();
        const blockedUntil = Date.now() + backoffMs;
        await fs.mkdir(path.dirname(lockPath), { recursive: true });
        await fs.writeFile(lockPath, JSON.stringify({ blockedUntil }), "utf8");
    }
    catch {
        // ignore
    }
}
async function isLockedUntil() {
    try {
        const raw = await fs.readFile(getUsageLockPath(), "utf8");
        const parsed = JSON.parse(raw);
        return typeof parsed.blockedUntil === "number" && parsed.blockedUntil > Date.now();
    }
    catch {
        return false;
    }
}
function parseUsageData(body) {
    const data = {};
    if (typeof body.five_hour?.utilization === "number" && typeof body.five_hour?.resets_at === "string") {
        data.fiveHour = { utilization: body.five_hour.utilization, resetsAt: body.five_hour.resets_at };
    }
    if (typeof body.seven_day?.utilization === "number" && typeof body.seven_day?.resets_at === "string") {
        data.sevenDay = { utilization: body.seven_day.utilization, resetsAt: body.seven_day.resets_at };
    }
    return data.fiveHour || data.sevenDay ? data : undefined;
}
async function fetchUsageFromApi(token) {
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
    return parseUsageData((await response.json()));
}
function isValidCache(cached) {
    return cached !== null && typeof cached.fetchedAt === "string" && cached.data !== undefined;
}
export async function getUsageData() {
    try {
        const cachePath = getUsageCachePath();
        const cached = await readJsonIfExists(cachePath);
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
        const entry = {
            fetchedAt: new Date().toISOString(),
            data: result
        };
        writeJsonAtomic(cachePath, entry).catch(() => { });
        return result;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=usage.js.map