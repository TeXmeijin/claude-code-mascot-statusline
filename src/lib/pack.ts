import { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { DEFAULT_PACK_NAME, DEFAULT_TIMINGS, PROJECT_PACKS_RELATIVE_PATH, USER_PACKS_DIR } from "./constants.js";
import type { LoadedPack, MascotState, PackManifest, PaletteColor, SpriteFrame, StatusLineInput } from "./types.js";

const BUNDLED_PACKS_DIR = path.resolve(fileURLToPath(new URL("../../packs", import.meta.url)));

export async function loadPack(options: {
  input?: StatusLineInput;
  packName?: string | null;
  cwd?: string;
}): Promise<LoadedPack> {
  const packName = options.packName ?? DEFAULT_PACK_NAME;
  for (const root of discoverPackRoots(options.input, options.cwd)) {
    const candidateRoot = path.join(root, packName);
    const manifest = await readPackManifest(candidateRoot);
    if (!manifest) {
      continue;
    }
    validateManifest(candidateRoot, manifest);
    return {
      rootDir: candidateRoot,
      manifestPath: await resolveManifestPath(candidateRoot),
      manifest
    };
  }

  throw new Error(`Pack "${packName}" was not found`);
}

export async function listAvailablePacks(options: {
  input?: StatusLineInput;
  cwd?: string;
} = {}): Promise<LoadedPack[]> {
  const seenNames = new Set<string>();
  const packs: LoadedPack[] = [];

  for (const root of discoverPackRoots(options.input, options.cwd)) {
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidateRoot = path.join(root, entry.name);
      const manifest = await readPackManifest(candidateRoot);
      if (!manifest) {
        continue;
      }
      validateManifest(candidateRoot, manifest);
      if (seenNames.has(manifest.name)) {
        continue;
      }
      seenNames.add(manifest.name);
      packs.push({
        rootDir: candidateRoot,
        manifestPath: await resolveManifestPath(candidateRoot),
        manifest
      });
    }
  }

  return packs.sort((left, right) => left.manifest.displayName.localeCompare(right.manifest.displayName));
}

export function discoverPackRoots(input?: StatusLineInput, cwd?: string): string[] {
  const projectDir = input?.workspace?.project_dir ?? cwd ?? process.cwd();
  return [path.join(projectDir, PROJECT_PACKS_RELATIVE_PATH), USER_PACKS_DIR, BUNDLED_PACKS_DIR];
}

export async function validatePackDirectory(packDir: string): Promise<LoadedPack> {
  const manifest = await readPackManifest(packDir);
  if (!manifest) {
    throw new Error(`Missing pack manifest in ${packDir}`);
  }

  validateManifest(packDir, manifest);

  return {
    rootDir: packDir,
    manifestPath: await resolveManifestPath(packDir),
    manifest
  };
}

export function loadSpriteFrame(pack: LoadedPack, state: MascotState, options: {
  narrow: boolean;
  now: Date;
  stateChangedAt?: string;
}): SpriteFrame {
  const spriteName = resolveSpriteName(pack.manifest, state, options);
  const frame = pack.manifest.sprites[spriteName];
  if (!frame) {
    throw new Error(`Sprite "${spriteName}" is missing in pack ${pack.manifest.name}`);
  }
  return frame;
}

export function getSpriteNamesForState(pack: LoadedPack, state: MascotState, narrow: boolean): string[] {
  if (narrow && pack.manifest.fallbacks.narrow) {
    return [pack.manifest.fallbacks.narrow];
  }

  const stateFrames = pack.manifest.states[state];
  if (!stateFrames || stateFrames.length === 0) {
    return [pack.manifest.fallbacks.unknown];
  }
  return stateFrames;
}

export function resolveStateHoldMs(pack: LoadedPack, state: MascotState): number {
  const timing = pack.manifest.timing ?? {};
  switch (state) {
    case "done":
      return timing.doneHoldMs ?? DEFAULT_TIMINGS.doneHoldMs;
    case "tool_success":
      return timing.successHoldMs ?? DEFAULT_TIMINGS.successHoldMs;
    case "tool_failure":
      return timing.failureHoldMs ?? DEFAULT_TIMINGS.failureHoldMs;
    case "auth_success":
      return timing.authHoldMs ?? DEFAULT_TIMINGS.authHoldMs;
    default:
      return 0;
  }
}

export function resolveSpriteName(
  manifest: PackManifest,
  state: MascotState,
  options: {
    narrow: boolean;
    now: Date;
    stateChangedAt?: string;
  }
): string {
  if (options.narrow && manifest.fallbacks.narrow) {
    return manifest.fallbacks.narrow;
  }

  const stateFrames = manifest.states[state];
  if (!stateFrames || stateFrames.length === 0) {
    return manifest.fallbacks.unknown;
  }

  const periodMs = resolveFramePeriod(manifest, state);
  if (!periodMs || stateFrames.length === 1) {
    return stateFrames[0] ?? manifest.fallbacks.unknown;
  }

  const anchor = options.stateChangedAt ? Date.parse(options.stateChangedAt) : options.now.getTime();
  const elapsedMs = Math.max(0, options.now.getTime() - anchor);
  const frameIndex = Math.floor(elapsedMs / periodMs) % stateFrames.length;
  return stateFrames[frameIndex] ?? stateFrames[0] ?? manifest.fallbacks.unknown;
}

async function resolveManifestPath(packDir: string): Promise<string> {
  const jsonPath = path.join(packDir, "pack.json");
  try {
    await fs.access(jsonPath);
    return jsonPath;
  } catch {
    return path.join(packDir, "pack.yaml");
  }
}

async function readPackManifest(packDir: string): Promise<PackManifest | null> {
  const jsonPath = path.join(packDir, "pack.json");
  const yamlPath = path.join(packDir, "pack.yaml");

  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    return JSON.parse(raw) as PackManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    const raw = await fs.readFile(yamlPath, "utf8");
    return YAML.parse(raw) as PackManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function validateManifest(packDir: string, manifest: PackManifest): void {
  if (manifest.specVersion !== 2) {
    throw new Error(`Unsupported specVersion in ${packDir}`);
  }
  if (!manifest.name || !manifest.displayName) {
    throw new Error(`Pack metadata is incomplete in ${packDir}`);
  }
  if (!manifest.sprite || manifest.sprite.width < 1 || manifest.sprite.height < 1) {
    throw new Error(`Invalid sprite spec in ${packDir}`);
  }
  if (!Array.isArray(manifest.sprite.palette) || manifest.sprite.palette.length < 2) {
    throw new Error(`Palette must contain at least transparent + 1 color in ${packDir}`);
  }
  if (!manifest.fallbacks?.unknown) {
    throw new Error(`Pack must define fallbacks.unknown in ${packDir}`);
  }
  if (!manifest.sprites || Object.keys(manifest.sprites).length === 0) {
    throw new Error(`Pack must define sprite data in ${packDir}`);
  }

  manifest.sprite.palette = manifest.sprite.palette.map((entry, index) =>
    normalizePaletteColor(entry, index, packDir)
  );

  for (const [name, frame] of Object.entries(manifest.sprites)) {
    validateSpriteFrame(frame, manifest.sprite.width, manifest.sprite.height, manifest.sprite.palette.length, name, packDir);
  }

  for (const spriteName of listAllSpriteNames(manifest)) {
    if (!manifest.sprites[spriteName]) {
      throw new Error(`Unknown sprite reference "${spriteName}" in ${packDir}`);
    }
  }
}

function resolveFramePeriod(manifest: PackManifest, state: MascotState): number {
  switch (state) {
    case "idle":
      return manifest.timing?.idleFramePeriodMs ?? DEFAULT_TIMINGS.idleFramePeriodMs;
    case "thinking":
    case "subagent_running":
      return manifest.timing?.thinkingFramePeriodMs ?? DEFAULT_TIMINGS.thinkingFramePeriodMs;
    case "tool_running":
      return manifest.timing?.toolFramePeriodMs ?? DEFAULT_TIMINGS.toolFramePeriodMs;
    default:
      return 0;
  }
}

function listAllSpriteNames(manifest: PackManifest): string[] {
  const stateFrames = Object.values(manifest.states).flatMap((frames) => frames ?? []);
  const fallbackFrames = [manifest.fallbacks.unknown, manifest.fallbacks.narrow].filter(
    (value): value is string => Boolean(value)
  );
  return [...new Set([...stateFrames, ...fallbackFrames])];
}

function validateSpriteFrame(
  frame: SpriteFrame,
  expectedWidth: number,
  expectedHeight: number,
  paletteSize: number,
  spriteName: string,
  packDir: string
): void {
  if (!Array.isArray(frame) || frame.length !== expectedHeight) {
    throw new Error(`Sprite "${spriteName}" must have ${expectedHeight} rows in ${packDir}`);
  }

  for (const row of frame) {
    if (!Array.isArray(row) || row.length !== expectedWidth) {
      throw new Error(`Sprite "${spriteName}" must have ${expectedWidth} columns in ${packDir}`);
    }

    for (const value of row) {
      if (!Number.isInteger(value) || value < 0 || value >= paletteSize) {
        throw new Error(`Sprite "${spriteName}" has palette index out of range in ${packDir}`);
      }
    }
  }
}

function normalizePaletteColor(entry: PaletteColor, index: number, packDir: string): PaletteColor {
  if (entry === null || entry === "transparent") {
    return null;
  }
  if (typeof entry !== "string" || !/^#[0-9a-fA-F]{6}$/.test(entry)) {
    throw new Error(`Palette entry ${index} must be null, "transparent", or #RRGGBB in ${packDir}`);
  }
  return entry.toLowerCase();
}
