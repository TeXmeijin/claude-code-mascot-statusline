import { describe, expect, it } from "vitest";

import { analyzeCapture } from "../src/lib/capture-analysis.js";
import type { PngImage } from "../src/lib/png.js";

describe("analyzeCapture", () => {
  it("detects a lower-left leaning subject inside a crop", () => {
    const image = createImage(12, 10, [10, 10, 10, 255]);

    paint(image, 3, 2, [240, 220, 180, 255]);
    paint(image, 4, 2, [240, 220, 180, 255]);
    paint(image, 5, 2, [240, 220, 180, 255]);
    paint(image, 3, 3, [240, 220, 180, 255]);
    paint(image, 4, 3, [240, 220, 180, 255]);
    paint(image, 2, 6, [240, 220, 180, 255]);
    paint(image, 3, 6, [240, 220, 180, 255]);
    paint(image, 4, 6, [240, 220, 180, 255]);
    paint(image, 2, 7, [240, 220, 180, 255]);
    paint(image, 3, 7, [240, 220, 180, 255]);

    const analysis = analyzeCapture(image, {
      crop: { x: 0, y: 0, width: 10, height: 10 },
      threshold: 20
    });

    expect(analysis.subjectBounds).toEqual({ x: 2, y: 2, width: 4, height: 6 });
    expect(analysis.bottomOffset).not.toBeNull();
    expect((analysis.bottomOffset ?? 0) < (analysis.topOffset ?? 0)).toBe(true);
    expect(analysis.warnings).toContain("upper and lower rendered centers disagree");
  });
});

function createImage(width: number, height: number, rgba: [number, number, number, number]): PngImage {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[offset] = rgba[0];
    data[offset + 1] = rgba[1];
    data[offset + 2] = rgba[2];
    data[offset + 3] = rgba[3];
  }
  return { width, height, data };
}

function paint(image: PngImage, x: number, y: number, rgba: [number, number, number, number]): void {
  const offset = (y * image.width + x) * 4;
  image.data[offset] = rgba[0];
  image.data[offset + 1] = rgba[1];
  image.data[offset + 2] = rgba[2];
  image.data[offset + 3] = rgba[3];
}
