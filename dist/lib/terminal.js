export function shouldUseColor(mode) {
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
export function getWidthHint(explicitWidth) {
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
export function shellQuote(value) {
    if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
        return value;
    }
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
//# sourceMappingURL=terminal.js.map