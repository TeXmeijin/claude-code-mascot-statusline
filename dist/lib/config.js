import path from "node:path";
import { DEFAULT_PACK_NAME, PROJECT_CONFIG_RELATIVE_PATH, USER_CONFIG_PATH } from "./constants.js";
import { readJsonIfExists } from "./fs.js";
import { SUMMARY_ITEM_KEYS } from "./types.js";
export async function loadMascotConfig(projectDir) {
    const projectConfigPath = projectDir ? path.join(projectDir, PROJECT_CONFIG_RELATIVE_PATH) : null;
    const [userConfig, projectConfig] = await Promise.all([
        readJsonIfExists(USER_CONFIG_PATH),
        projectConfigPath ? readJsonIfExists(projectConfigPath) : Promise.resolve(null)
    ]);
    return {
        pack: process.env.CLAUDE_MASCOT_PACK ?? projectConfig?.pack ?? userConfig?.pack ?? DEFAULT_PACK_NAME,
        color: normalizeColorMode(process.env.CLAUDE_MASCOT_COLOR) ??
            projectConfig?.color ??
            userConfig?.color ??
            "auto",
        twoLine: normalizeBoolean(process.env.CLAUDE_MASCOT_TWO_LINE) ??
            projectConfig?.twoLine ??
            userConfig?.twoLine ??
            true,
        renderProfile: normalizeRenderProfile(process.env.CLAUDE_MASCOT_RENDER_PROFILE) ??
            projectConfig?.renderProfile ??
            userConfig?.renderProfile ??
            "claude-code-safe",
        safeBackground: normalizeHexColor(process.env.CLAUDE_MASCOT_SAFE_BACKGROUND) ??
            normalizeHexColor(projectConfig?.safeBackground) ??
            normalizeHexColor(userConfig?.safeBackground) ??
            "#333333",
        summaryItems: normalizeSummaryItems(projectConfig?.summaryItems) ??
            normalizeSummaryItems(userConfig?.summaryItems) ??
            undefined
    };
}
function normalizeBoolean(value) {
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
function normalizeColorMode(value) {
    if (value === "auto" || value === "always" || value === "never") {
        return value;
    }
    return undefined;
}
function normalizeRenderProfile(value) {
    if (value === "auto" || value === "claude-code-safe") {
        return value;
    }
    return undefined;
}
function normalizeSummaryItems(value) {
    if (!Array.isArray(value))
        return undefined;
    const valid = value.filter((v) => typeof v === "string" && SUMMARY_ITEM_KEYS.includes(v));
    return valid.length > 0 ? valid : undefined;
}
function normalizeHexColor(value) {
    if (!value) {
        return undefined;
    }
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : undefined;
}
//# sourceMappingURL=config.js.map