#!/usr/bin/env node
import path from "node:path";
import { analyzeCapture } from "../lib/capture-analysis.js";
import { readPng } from "../lib/png.js";
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.image) {
        throw new Error("Usage: claude-mascot-analyze-capture --image <png-path> [--crop x,y,w,h] [--threshold N]");
    }
    const image = await readPng(path.resolve(args.image));
    const analysis = analyzeCapture(image, {
        crop: args.crop,
        threshold: args.threshold
    });
    const lines = [
        `Image: ${path.resolve(args.image)}`,
        `Canvas: ${image.width}x${image.height}`,
        `Crop: ${formatRect(analysis.crop)}`,
        `Background: rgba(${analysis.background.r}, ${analysis.background.g}, ${analysis.background.b}, ${analysis.background.a})`,
        `Filled pixels: ${analysis.filledPixels}`,
        `Subject bounds: ${analysis.subjectBounds ? formatRect(analysis.subjectBounds) : "not found"}`,
        `Offsets: overall=${formatOffset(analysis.overallCenterOffset)} | top=${formatOffset(analysis.topOffset)} | bottom=${formatOffset(analysis.bottomOffset)}`
    ];
    if (analysis.warnings.length > 0) {
        lines.push(`Warnings: ${analysis.warnings.join("; ")}`);
    }
    process.stdout.write(lines.join("\n"));
    process.stdout.write("\n");
}
function parseArgs(argv) {
    const flags = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        if (!current?.startsWith("--")) {
            continue;
        }
        const key = current.slice(2);
        const next = argv[index + 1];
        if (next && !next.startsWith("--")) {
            flags.set(key, next);
            index += 1;
        }
    }
    return {
        image: flags.get("image") ?? null,
        crop: flags.get("crop") ? parseCrop(flags.get("crop")) : undefined,
        threshold: flags.get("threshold") ? Number.parseInt(flags.get("threshold"), 10) : undefined
    };
}
function parseCrop(value) {
    const parts = value.split(",").map((part) => Number.parseInt(part.trim(), 10));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
        throw new Error("Invalid --crop value. Expected x,y,width,height");
    }
    return {
        x: parts[0] ?? 0,
        y: parts[1] ?? 0,
        width: parts[2] ?? 1,
        height: parts[3] ?? 1
    };
}
function formatRect(rect) {
    return `${rect.x},${rect.y},${rect.width},${rect.height}`;
}
function formatOffset(value) {
    if (value === null) {
        return "n/a";
    }
    return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}
main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
//# sourceMappingURL=analyze-capture.js.map