import { describe, expect, it } from "vitest";

import { listAvailablePacks } from "../src/lib/pack.js";

describe("listAvailablePacks", () => {
  it("finds bundled packs for gallery use", async () => {
    const packs = await listAvailablePacks({ cwd: process.cwd() });
    expect(packs.length).toBeGreaterThan(0);
    expect(packs.some((pack) => pack.manifest.name === "pixel-buddy")).toBe(true);
  });
});
