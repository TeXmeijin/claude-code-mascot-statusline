import { describe, expect, it } from "vitest";

import { analyzeSpriteFrame } from "../src/lib/visual-lint.js";

describe("analyzeSpriteFrame", () => {
  it("flags lower-left bias and top-bottom disagreement", () => {
    const lint = analyzeSpriteFrame([
      [0, 0, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 0, 0],
      [1, 1, 1, 0, 0, 0],
      [1, 1, 1, 0, 0, 0],
      [1, 1, 0, 0, 0, 0]
    ]);

    expect(lint.warnings).toContain("lower sprite leans left");
    expect(lint.warnings).toContain("top and bottom centers disagree");
  });

  it("accepts a centered symmetric sprite", () => {
    const lint = analyzeSpriteFrame([
      [0, 1, 0, 0, 1, 0],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 0, 0],
      [0, 0, 1, 1, 0, 0]
    ]);

    expect(lint.overallCenterOffset).toBe(0);
    expect(lint.mirrorMismatchRatio).toBe(0);
    expect(lint.warnings).toHaveLength(0);
  });
});
