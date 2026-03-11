import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
export async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
export async function readTextIfExists(filePath) {
    try {
        return await fs.readFile(filePath, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}
export async function readJsonIfExists(filePath) {
    const raw = await readTextIfExists(filePath);
    if (raw === null) {
        return null;
    }
    return JSON.parse(raw);
}
export async function writeJsonAtomic(filePath, value) {
    const tempPath = `${filePath}.${process.pid}.tmp`;
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(tempPath, JSON.stringify(value), "utf8");
    await fs.rename(tempPath, filePath);
}
export function hashId(value) {
    return crypto.createHash("sha1").update(value).digest("hex");
}
export function resolveInside(rootDir, relativePath) {
    const resolved = path.resolve(rootDir, relativePath);
    const relative = path.relative(rootDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Path escapes pack root: ${relativePath}`);
    }
    return resolved;
}
//# sourceMappingURL=fs.js.map