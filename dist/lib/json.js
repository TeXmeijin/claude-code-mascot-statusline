export function parseJson(raw, fallback) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
export function safeJsonStringify(value) {
    return JSON.stringify(value, null, 2);
}
//# sourceMappingURL=json.js.map