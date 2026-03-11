import type { SpriteFrame } from "./types.js";

export interface VisualLintBand {
  label: "top" | "middle" | "bottom";
  filledPixels: number;
  centerOffset: number | null;
}

export interface SpriteVisualLint {
  filledPixels: number;
  overallCenterOffset: number | null;
  mirrorMismatchRatio: number;
  bands: VisualLintBand[];
  warnings: string[];
}

export function analyzeSpriteFrame(frame: SpriteFrame): SpriteVisualLint {
  const height = frame.length;
  const width = frame[0]?.length ?? 0;
  const targetCenter = (width - 1) / 2;
  const occupancy = frame.map((row) => row.map((value) => (value === 0 ? 0 : 1)));

  let totalFilled = 0;
  let weightedX = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (occupancy[y]?.[x] !== 1) {
        continue;
      }
      totalFilled += 1;
      weightedX += x;
    }
  }

  const overallCenter = totalFilled > 0 ? weightedX / totalFilled : null;
  const overallCenterOffset = overallCenter === null ? null : round(overallCenter - targetCenter);

  const bands = buildBands(occupancy, targetCenter);
  const mirrorMismatchRatio = round(computeMirrorMismatchRatio(occupancy));
  const warnings = buildWarnings(overallCenterOffset, bands, mirrorMismatchRatio);

  return {
    filledPixels: totalFilled,
    overallCenterOffset,
    mirrorMismatchRatio,
    bands,
    warnings
  };
}

export function formatVisualLint(lint: SpriteVisualLint): string[] {
  const bandSummary = lint.bands
    .map((band) => `${band.label}:${formatOffset(band.centerOffset)}`)
    .join(" | ");

  const lines = [
    `Visual lint: overall:${formatOffset(lint.overallCenterOffset)} | mirror:${lint.mirrorMismatchRatio.toFixed(2)} | ${bandSummary}`
  ];

  if (lint.warnings.length > 0) {
    lines.push(`Warnings: ${lint.warnings.join("; ")}`);
  }

  return lines;
}

function buildBands(occupancy: number[][], targetCenter: number): VisualLintBand[] {
  const height = occupancy.length;
  const boundaries = [0, Math.ceil(height / 3), Math.ceil((height * 2) / 3), height];
  const labels: VisualLintBand["label"][] = ["top", "middle", "bottom"];

  return labels.map((label, index) => {
    const start = boundaries[index] ?? 0;
    const end = boundaries[index + 1] ?? height;
    let filledPixels = 0;
    let weightedX = 0;

    for (let y = start; y < end; y += 1) {
      for (let x = 0; x < (occupancy[y]?.length ?? 0); x += 1) {
        if (occupancy[y]?.[x] !== 1) {
          continue;
        }
        filledPixels += 1;
        weightedX += x;
      }
    }

    return {
      label,
      filledPixels,
      centerOffset: filledPixels > 0 ? round(weightedX / filledPixels - targetCenter) : null
    };
  });
}

function computeMirrorMismatchRatio(occupancy: number[][]): number {
  const height = occupancy.length;
  const width = occupancy[0]?.length ?? 0;
  const half = Math.floor(width / 2);
  let mismatches = 0;
  let comparisons = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < half; x += 1) {
      const left = occupancy[y]?.[x] ?? 0;
      const right = occupancy[y]?.[width - 1 - x] ?? 0;
      comparisons += 1;
      if (left !== right) {
        mismatches += 1;
      }
    }
  }

  if (comparisons === 0) {
    return 0;
  }
  return mismatches / comparisons;
}

function buildWarnings(
  overallCenterOffset: number | null,
  bands: VisualLintBand[],
  mirrorMismatchRatio: number
): string[] {
  const warnings: string[] = [];

  if (overallCenterOffset !== null && overallCenterOffset <= -0.35) {
    warnings.push("overall mass leans left");
  } else if (overallCenterOffset !== null && overallCenterOffset >= 0.35) {
    warnings.push("overall mass leans right");
  }

  const top = bands.find((band) => band.label === "top")?.centerOffset ?? null;
  const bottom = bands.find((band) => band.label === "bottom")?.centerOffset ?? null;

  if (top !== null && top <= -0.5) {
    warnings.push("upper sprite leans left");
  } else if (top !== null && top >= 0.5) {
    warnings.push("upper sprite leans right");
  }

  if (bottom !== null && bottom <= -0.5) {
    warnings.push("lower sprite leans left");
  } else if (bottom !== null && bottom >= 0.5) {
    warnings.push("lower sprite leans right");
  }

  if (top !== null && bottom !== null && Math.abs(top - bottom) >= 0.5) {
    warnings.push("top and bottom centers disagree");
  }

  if (mirrorMismatchRatio >= 0.18) {
    warnings.push("low left/right symmetry");
  }

  return warnings;
}

function formatOffset(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  if (value === 0) {
    return "0.00";
  }
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
