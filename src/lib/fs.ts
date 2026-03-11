import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  const raw = await readTextIfExists(filePath);
  if (raw === null) {
    return null;
  }
  return JSON.parse(raw) as T;
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(tempPath, JSON.stringify(value), "utf8");
  await fs.rename(tempPath, filePath);
}

export function hashId(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex");
}

export function resolveInside(rootDir: string, relativePath: string): string {
  const resolved = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes pack root: ${relativePath}`);
  }
  return resolved;
}
