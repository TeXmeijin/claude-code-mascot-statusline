import path from "node:path";

import { describe, expect, it } from "vitest";

import { validatePackDirectory } from "../src/lib/pack.js";

describe("validatePackDirectory", () => {
  it("accepts the bundled default pack", async () => {
    const pack = await validatePackDirectory(path.join(process.cwd(), "packs", "pixel-buddy"));

    expect(pack.manifest.name).toBe("pixel-buddy");
    expect(pack.manifest.sprite.width).toBe(16);
    expect(pack.manifest.sprite.height).toBe(16);
    expect(pack.manifest.sprite.palette[0]).toBe(null);
  });

  it("accepts the example external pack", async () => {
    const pack = await validatePackDirectory(path.join(process.cwd(), "examples", "external-pack"));

    expect(pack.manifest.name).toBe("terminal-sprout");
    expect(pack.manifest.sprite.height).toBe(6);
  });
});
