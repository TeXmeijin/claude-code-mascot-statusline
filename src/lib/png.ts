import fs from "node:fs/promises";
import zlib from "node:zlib";

export interface PngImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export async function readPng(path: string): Promise<PngImage> {
  const bytes = new Uint8Array(await fs.readFile(path));
  assertSignature(bytes);

  let cursor = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (cursor < bytes.length) {
    const length = readUint32(bytes, cursor);
    const type = readAscii(bytes, cursor + 4, 4);
    const chunkDataStart = cursor + 8;
    const chunkDataEnd = chunkDataStart + length;

    if (type === "IHDR") {
      width = readUint32(bytes, chunkDataStart);
      height = readUint32(bytes, chunkDataStart + 4);
      bitDepth = bytes[chunkDataStart + 8] ?? 0;
      colorType = bytes[chunkDataStart + 9] ?? 0;
    } else if (type === "IDAT") {
      idatChunks.push(bytes.slice(chunkDataStart, chunkDataEnd));
    } else if (type === "IEND") {
      break;
    }

    cursor = chunkDataEnd + 4;
  }

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  }
  if (colorType !== 6 && colorType !== 2) {
    throw new Error(`Unsupported PNG color type: ${colorType}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks.map((chunk) => Buffer.from(chunk))));
  const rgba = new Uint8Array(width * height * 4);
  const previous = new Uint8Array(stride);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[sourceOffset] ?? 0;
    sourceOffset += 1;
    const scanline = inflated.subarray(sourceOffset, sourceOffset + stride);
    sourceOffset += stride;
    const unfiltered = unfilterScanline(scanline, previous, filterType, channels);
    previous.set(unfiltered);

    for (let x = 0; x < width; x += 1) {
      const sourceIndex = x * channels;
      const targetIndex = (y * width + x) * 4;
      rgba[targetIndex] = unfiltered[sourceIndex] ?? 0;
      rgba[targetIndex + 1] = unfiltered[sourceIndex + 1] ?? 0;
      rgba[targetIndex + 2] = unfiltered[sourceIndex + 2] ?? 0;
      rgba[targetIndex + 3] = channels === 4 ? (unfiltered[sourceIndex + 3] ?? 255) : 255;
    }
  }

  return {
    width,
    height,
    data: rgba
  };
}

function assertSignature(bytes: Uint8Array): void {
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error("Unsupported image: not a PNG");
    }
  }
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function unfilterScanline(
  scanline: Uint8Array,
  previous: Uint8Array,
  filterType: number,
  channels: number
): Uint8Array {
  const output = new Uint8Array(scanline.length);

  for (let index = 0; index < scanline.length; index += 1) {
    const left = index >= channels ? output[index - channels] ?? 0 : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= channels ? (previous[index - channels] ?? 0) : 0;
    const value = scanline[index] ?? 0;

    switch (filterType) {
      case 0:
        output[index] = value;
        break;
      case 1:
        output[index] = (value + left) & 0xff;
        break;
      case 2:
        output[index] = (value + up) & 0xff;
        break;
      case 3:
        output[index] = (value + Math.floor((left + up) / 2)) & 0xff;
        break;
      case 4:
        output[index] = (value + paethPredictor(left, up, upLeft)) & 0xff;
        break;
      default:
        throw new Error(`Unsupported PNG filter type: ${filterType}`);
    }
  }

  return output;
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const predictor = left + up - upLeft;
  const leftDistance = Math.abs(predictor - left);
  const upDistance = Math.abs(predictor - up);
  const upLeftDistance = Math.abs(predictor - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  if (upDistance <= upLeftDistance) {
    return up;
  }
  return upLeft;
}
