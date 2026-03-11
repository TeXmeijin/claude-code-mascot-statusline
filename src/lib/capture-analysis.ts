import type { PngImage } from "./png.js";

export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureAnalysis {
  crop: CaptureRect;
  subjectBounds: CaptureRect | null;
  background: { r: number; g: number; b: number; a: number };
  overallCenterOffset: number | null;
  topOffset: number | null;
  bottomOffset: number | null;
  filledPixels: number;
  warnings: string[];
}

export function analyzeCapture(image: PngImage, options: {
  crop?: CaptureRect;
  threshold?: number;
} = {}): CaptureAnalysis {
  const crop = clampRect(options.crop ?? { x: 0, y: 0, width: image.width, height: image.height }, image.width, image.height);
  const background = sampleBackground(image, crop);
  const threshold = options.threshold ?? 26;
  const subject = findSubjectBounds(image, crop, background, threshold);

  if (!subject) {
    return {
      crop,
      subjectBounds: null,
      background,
      overallCenterOffset: null,
      topOffset: null,
      bottomOffset: null,
      filledPixels: 0,
      warnings: ["no foreground region detected"]
    };
  }

  const metrics = analyzeBounds(image, subject, background, threshold);
  const warnings = buildWarnings(metrics.overallCenterOffset, metrics.topOffset, metrics.bottomOffset);

  return {
    crop,
    subjectBounds: subject,
    background,
    overallCenterOffset: metrics.overallCenterOffset,
    topOffset: metrics.topOffset,
    bottomOffset: metrics.bottomOffset,
    filledPixels: metrics.filledPixels,
    warnings
  };
}

function analyzeBounds(
  image: PngImage,
  rect: CaptureRect,
  background: { r: number; g: number; b: number; a: number },
  threshold: number
): {
  overallCenterOffset: number | null;
  topOffset: number | null;
  bottomOffset: number | null;
  filledPixels: number;
} {
  const targetCenter = rect.width / 2;
  const topSplit = rect.y + Math.floor(rect.height / 2);
  let filledPixels = 0;
  let weightedX = 0;
  let topPixels = 0;
  let topWeightedX = 0;
  let bottomPixels = 0;
  let bottomWeightedX = 0;

  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (!isForeground(image, x, y, background, threshold)) {
        continue;
      }
      const localX = x - rect.x + 0.5;
      filledPixels += 1;
      weightedX += localX;
      if (y < topSplit) {
        topPixels += 1;
        topWeightedX += localX;
      } else {
        bottomPixels += 1;
        bottomWeightedX += localX;
      }
    }
  }

  return {
    overallCenterOffset: filledPixels > 0 ? round(weightedX / filledPixels - targetCenter) : null,
    topOffset: topPixels > 0 ? round(topWeightedX / topPixels - targetCenter) : null,
    bottomOffset: bottomPixels > 0 ? round(bottomWeightedX / bottomPixels - targetCenter) : null,
    filledPixels
  };
}

function findSubjectBounds(
  image: PngImage,
  crop: CaptureRect,
  background: { r: number; g: number; b: number; a: number },
  threshold: number
): CaptureRect | null {
  let minX = crop.x + crop.width;
  let minY = crop.y + crop.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = crop.y; y < crop.y + crop.height; y += 1) {
    for (let x = crop.x; x < crop.x + crop.width; x += 1) {
      if (!isForeground(image, x, y, background, threshold)) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function sampleBackground(image: PngImage, crop: CaptureRect): { r: number; g: number; b: number; a: number } {
  const samplePoints = [
    [crop.x, crop.y],
    [crop.x + crop.width - 1, crop.y],
    [crop.x, crop.y + crop.height - 1],
    [crop.x + crop.width - 1, crop.y + crop.height - 1]
  ];

  const samples = samplePoints.map(([x, y]) => readPixel(image, x, y));
  return {
    r: Math.round(samples.reduce((sum, sample) => sum + sample.r, 0) / samples.length),
    g: Math.round(samples.reduce((sum, sample) => sum + sample.g, 0) / samples.length),
    b: Math.round(samples.reduce((sum, sample) => sum + sample.b, 0) / samples.length),
    a: Math.round(samples.reduce((sum, sample) => sum + sample.a, 0) / samples.length)
  };
}

function isForeground(
  image: PngImage,
  x: number,
  y: number,
  background: { r: number; g: number; b: number; a: number },
  threshold: number
): boolean {
  const pixel = readPixel(image, x, y);
  const distance = Math.abs(pixel.r - background.r) + Math.abs(pixel.g - background.g) + Math.abs(pixel.b - background.b);
  return distance >= threshold;
}

function readPixel(image: PngImage, x: number, y: number): { r: number; g: number; b: number; a: number } {
  const index = (y * image.width + x) * 4;
  return {
    r: image.data[index] ?? 0,
    g: image.data[index + 1] ?? 0,
    b: image.data[index + 2] ?? 0,
    a: image.data[index + 3] ?? 255
  };
}

function clampRect(rect: CaptureRect, imageWidth: number, imageHeight: number): CaptureRect {
  const x = Math.max(0, Math.min(rect.x, imageWidth - 1));
  const y = Math.max(0, Math.min(rect.y, imageHeight - 1));
  const width = Math.max(1, Math.min(rect.width, imageWidth - x));
  const height = Math.max(1, Math.min(rect.height, imageHeight - y));
  return { x, y, width, height };
}

function buildWarnings(overall: number | null, top: number | null, bottom: number | null): string[] {
  const warnings: string[] = [];
  if (overall !== null && overall <= -0.75) {
    warnings.push("rendered subject leans left");
  } else if (overall !== null && overall >= 0.75) {
    warnings.push("rendered subject leans right");
  }
  if (top !== null && top <= -0.75) {
    warnings.push("upper rendered subject leans left");
  } else if (top !== null && top >= 0.75) {
    warnings.push("upper rendered subject leans right");
  }
  if (bottom !== null && bottom <= -0.75) {
    warnings.push("lower rendered subject leans left");
  } else if (bottom !== null && bottom >= 0.75) {
    warnings.push("lower rendered subject leans right");
  }
  if (top !== null && bottom !== null && Math.abs(top - bottom) >= 0.75) {
    warnings.push("upper and lower rendered centers disagree");
  }
  return warnings;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
