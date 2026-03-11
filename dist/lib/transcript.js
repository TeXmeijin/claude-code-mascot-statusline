import fs from "node:fs/promises";
import { createInitialSessionState } from "./state.js";
const TRANSCRIPT_TAIL_BYTES = 256 * 1024;
const THINKING_STALE_MS = 45_000;
const RESULT_STALE_MS = 6_000;
export async function deriveSessionStateFromTranscript(transcriptPath, now) {
    if (!transcriptPath) {
        return null;
    }
    const lines = await readTranscriptTailLines(transcriptPath);
    if (lines.length === 0) {
        return null;
    }
    const entries = lines
        .map((line) => {
        try {
            return JSON.parse(line);
        }
        catch {
            return null;
        }
    })
        .filter((entry) => Boolean(entry));
    if (entries.length === 0) {
        return null;
    }
    const lastPromptIndex = findLastPromptIndex(entries);
    const relevantEntries = lastPromptIndex >= 0 ? entries.slice(lastPromptIndex) : entries;
    const sessionId = transcriptPath.split("/").pop()?.replace(/\.jsonl$/, "") ?? transcriptPath;
    const state = createInitialSessionState(sessionId, now);
    let currentState = "idle";
    let lastStateTimestamp = state.lastStateChangedAt;
    let lastUpdatedAt = state.lastUpdatedAt;
    let toolCount = 0;
    let failedToolCount = 0;
    let activeSubagentCount = 0;
    let subagentCountPeak = 0;
    let lastToolName = null;
    let turnSequence = lastPromptIndex >= 0 ? 1 : 0;
    let pendingTools = [];
    let sawPrompt = false;
    let lastMeaningfulType = null;
    for (const entry of relevantEntries) {
        const timestamp = normalizeTimestamp(entry.timestamp, now);
        lastUpdatedAt = timestamp;
        if (entry.type === "progress") {
            const hookEvent = entry.data?.hookEvent;
            if (hookEvent === "Stop") {
                currentState = "done";
                lastStateTimestamp = timestamp;
                lastMeaningfulType = "assistant_text";
            }
            continue;
        }
        if (entry.type === "user") {
            const contentItems = getContentItems(entry.message?.content);
            const toolResults = contentItems.filter((item) => item.type === "tool_result");
            if (toolResults.length > 0) {
                for (const result of toolResults) {
                    const toolName = lastToolName ?? "tool";
                    const pendingIndex = findLastPendingIndex(pendingTools, toolName);
                    const pending = pendingIndex >= 0 ? pendingTools.splice(pendingIndex, 1)[0] : null;
                    if (pending?.isSubagent) {
                        activeSubagentCount = Math.max(0, activeSubagentCount - 1);
                    }
                    const isError = detectToolResultError(result, entry);
                    if (isError) {
                        failedToolCount += 1;
                    }
                    if (activeSubagentCount > 0) {
                        currentState = "subagent_running";
                    }
                    else {
                        currentState = isError ? "tool_failure" : "tool_success";
                    }
                    lastStateTimestamp = timestamp;
                    lastMeaningfulType = "tool_result";
                }
                continue;
            }
            if (!isSystemReminder(entry.content ?? firstTextContent(contentItems))) {
                sawPrompt = true;
                currentState = "thinking";
                lastStateTimestamp = timestamp;
                toolCount = 0;
                failedToolCount = 0;
                activeSubagentCount = 0;
                subagentCountPeak = 0;
                lastToolName = null;
                pendingTools = [];
                lastMeaningfulType = "user";
            }
            continue;
        }
        if (entry.type === "assistant") {
            for (const item of getContentItems(entry.message?.content)) {
                if (item.type === "tool_use") {
                    const toolName = item.name ?? "tool";
                    const isSubagent = isSubagentTool(toolName, item.input);
                    toolCount += 1;
                    lastToolName = toolName;
                    pendingTools.push({ name: toolName, isSubagent });
                    if (isSubagent) {
                        activeSubagentCount += 1;
                        subagentCountPeak = Math.max(subagentCountPeak, activeSubagentCount);
                        currentState = "subagent_running";
                    }
                    else {
                        currentState = "tool_running";
                    }
                    lastStateTimestamp = timestamp;
                    lastMeaningfulType = "tool_use";
                    continue;
                }
                if (item.type === "thinking") {
                    currentState = "thinking";
                    lastStateTimestamp = timestamp;
                    lastMeaningfulType = "assistant_thinking";
                    continue;
                }
                if (item.type === "text" && sawPrompt && pendingTools.length === 0 && activeSubagentCount === 0) {
                    currentState = "done";
                    lastStateTimestamp = timestamp;
                    lastMeaningfulType = "assistant_text";
                }
            }
            continue;
        }
        if (entry.type === "tool_use") {
            const toolName = entry.tool_name ?? "tool";
            const isSubagent = isSubagentTool(toolName, entry.tool_input);
            toolCount += 1;
            lastToolName = toolName;
            pendingTools.push({ name: toolName, isSubagent });
            if (isSubagent) {
                activeSubagentCount += 1;
                subagentCountPeak = Math.max(subagentCountPeak, activeSubagentCount);
                currentState = "subagent_running";
            }
            else {
                currentState = "tool_running";
            }
            lastStateTimestamp = timestamp;
            lastMeaningfulType = "tool_use";
            continue;
        }
        if (entry.type === "tool_result") {
            const toolName = entry.tool_name ?? lastToolName ?? "tool";
            const pendingIndex = findLastPendingIndex(pendingTools, toolName);
            const pending = pendingIndex >= 0 ? pendingTools.splice(pendingIndex, 1)[0] : null;
            if (pending?.isSubagent) {
                activeSubagentCount = Math.max(0, activeSubagentCount - 1);
            }
            const isError = detectToolError(entry);
            if (isError) {
                failedToolCount += 1;
            }
            lastToolName = toolName;
            if (activeSubagentCount > 0) {
                currentState = "subagent_running";
            }
            else {
                currentState = isError ? "tool_failure" : "tool_success";
            }
            lastStateTimestamp = timestamp;
            lastMeaningfulType = "tool_result";
            continue;
        }
    }
    if (pendingTools.some((tool) => !tool.isSubagent)) {
        currentState = "tool_running";
    }
    else if (activeSubagentCount > 0) {
        currentState = "subagent_running";
    }
    else if (sawPrompt) {
        const ageMs = now.getTime() - Date.parse(lastUpdatedAt);
        if (lastMeaningfulType === "user" || lastMeaningfulType === "assistant_thinking") {
            currentState = ageMs < THINKING_STALE_MS ? "thinking" : "idle";
        }
        else if (lastMeaningfulType === "tool_result") {
            currentState = ageMs < RESULT_STALE_MS ? currentState : "idle";
        }
        else if (lastMeaningfulType === "assistant_text") {
            currentState = ageMs < RESULT_STALE_MS ? "done" : "idle";
        }
    }
    return {
        ...state,
        currentState,
        lastStateChangedAt: lastStateTimestamp,
        lastUpdatedAt,
        toolCountInTurn: toolCount,
        failedToolCountInTurn: failedToolCount,
        activeSubagentCount,
        subagentCountPeakInTurn: subagentCountPeak,
        lastToolName,
        turnSequenceNumber: turnSequence
    };
}
async function readTranscriptTailLines(transcriptPath) {
    try {
        const handle = await fs.open(transcriptPath, "r");
        try {
            const stats = await handle.stat();
            const readSize = Math.min(TRANSCRIPT_TAIL_BYTES, stats.size);
            const buffer = Buffer.alloc(readSize);
            await handle.read(buffer, 0, readSize, Math.max(0, stats.size - readSize));
            const raw = buffer.toString("utf8");
            const normalized = stats.size > readSize ? raw.slice(raw.indexOf("\n") + 1) : raw;
            return normalized.split("\n").filter(Boolean);
        }
        finally {
            await handle.close();
        }
    }
    catch {
        return [];
    }
}
function findLastPromptIndex(entries) {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (entry?.type === "user" &&
            !isToolResultEnvelope(entry) &&
            !isSystemReminder(entry.content ?? firstTextContent(entry.message?.content))) {
            return index;
        }
    }
    return -1;
}
function isSystemReminder(content) {
    return typeof content === "string" && content.startsWith("<system-reminder>");
}
function firstTextContent(content) {
    for (const item of getContentItems(content)) {
        if (typeof item.text === "string") {
            return item.text;
        }
        if (typeof item.content === "string") {
            return item.content;
        }
    }
    return undefined;
}
function isToolResultEnvelope(entry) {
    const contentItems = getContentItems(entry.message?.content);
    return contentItems.length > 0 && contentItems.every((item) => item.type === "tool_result");
}
function getContentItems(content) {
    if (Array.isArray(content)) {
        return content.filter((item) => typeof item === "object" && item !== null);
    }
    if (typeof content === "string") {
        return [{ type: "text", text: content }];
    }
    if (content && typeof content === "object") {
        return [content];
    }
    return [];
}
function isSubagentTool(toolName, input) {
    return toolName === "Task" || toolName === "call_omo_agent" || typeof input?.subagent_type === "string";
}
function findLastPendingIndex(pendingTools, toolName) {
    for (let index = pendingTools.length - 1; index >= 0; index -= 1) {
        if (pendingTools[index]?.name === toolName) {
            return index;
        }
    }
    return -1;
}
function detectToolError(entry) {
    if (entry.is_error || typeof entry.error === "string") {
        return true;
    }
    const toolOutput = entry.tool_output;
    if (!toolOutput || typeof toolOutput !== "object") {
        return false;
    }
    if (toolOutput.is_error === true || toolOutput.success === false) {
        return true;
    }
    const errorValue = toolOutput.error;
    return typeof errorValue === "string" && errorValue.length > 0;
}
function detectToolResultError(item, entry) {
    if (typeof item.content === "string") {
        const content = item.content.toLowerCase();
        if (content.includes("failed") || content.includes("error")) {
            return true;
        }
    }
    if (entry.toolUseResult && typeof entry.toolUseResult === "object") {
        return false;
    }
    return false;
}
function normalizeTimestamp(timestamp, now) {
    if (!timestamp) {
        return now.toISOString();
    }
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? now.toISOString() : new Date(parsed).toISOString();
}
//# sourceMappingURL=transcript.js.map