import { createHash } from "node:crypto";
import sharp from "sharp";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_ASSET_BYTES = 5_000_000;
const EXTERNAL_REFERENCE_PATTERN =
  /\b(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/|data:(?!image\/(?:png|jpeg|webp);base64,))/iu;
const ACTIVE_CONTENT_PATTERN =
  /<(?:script|foreignObject|iframe|object|embed|audio|video)\b|\bon[a-z]+\s*=|javascript\s*:|@import\b|url\s*\(\s*["']?\s*(?:https?:|\/\/)/iu;

export type SupportedBrandAssetMimeType = "image/png" | "image/svg+xml";

export interface AssetValidationInput {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
}

export interface AssetValidationResult {
  bytes: Uint8Array;
  checksumSha256: string;
  extension: ".png" | ".svg";
  mimeType: SupportedBrandAssetMimeType;
}

export interface InspectedBrandAsset extends AssetValidationResult {
  heightPx: number;
  widthPx: number;
}

export class BrandAssetValidationError extends Error {
  constructor(
    readonly code:
      | "ACTIVE_SVG_CONTENT"
      | "ASSET_EMPTY"
      | "ASSET_TOO_LARGE"
      | "INVALID_EXTENSION"
      | "INVALID_MAGIC_BYTES"
      | "INVALID_MIME_TYPE"
      | "INVALID_DIMENSIONS"
      | "INVALID_SVG",
  ) {
    super(`Brand asset rejected: ${code}`);
    this.name = "BrandAssetValidationError";
  }
}

export async function inspectBrandAsset(input: AssetValidationInput): Promise<InspectedBrandAsset> {
  const validated = validateBrandAsset(input);
  const metadata = await sharp(validated.bytes).metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 64 ||
    metadata.height < 64 ||
    metadata.width > 20_000 ||
    metadata.height > 20_000
  ) {
    throw new BrandAssetValidationError("INVALID_DIMENSIONS");
  }
  return {
    ...validated,
    heightPx: metadata.height,
    widthPx: metadata.width,
  };
}

function normalizedExtension(filename: string): ".png" | ".svg" {
  const normalized = filename.trim().toLowerCase();
  if (normalized.endsWith(".png")) {
    return ".png";
  }
  if (normalized.endsWith(".svg")) {
    return ".svg";
  }
  throw new BrandAssetValidationError("INVALID_EXTENSION");
}

function assertSize(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) {
    throw new BrandAssetValidationError("ASSET_EMPTY");
  }
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    throw new BrandAssetValidationError("ASSET_TOO_LARGE");
  }
}

export function sanitizeSvg(bytes: Uint8Array): Uint8Array {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
  if (!source.startsWith("<svg") && !source.startsWith("<?xml") && !source.startsWith("<!--")) {
    throw new BrandAssetValidationError("INVALID_SVG");
  }
  if (!/<svg(?:\s|>)/iu.test(source) || !/<\/svg>\s*$/iu.test(source)) {
    throw new BrandAssetValidationError("INVALID_SVG");
  }
  if (ACTIVE_CONTENT_PATTERN.test(source) || EXTERNAL_REFERENCE_PATTERN.test(source)) {
    throw new BrandAssetValidationError("ACTIVE_SVG_CONTENT");
  }

  const sanitized = source
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<\?xml[\s\S]*?\?>/giu, "")
    .replace(/<!DOCTYPE[\s\S]*?>/giu, "")
    .trim();

  if (!sanitized.startsWith("<svg") || !sanitized.endsWith("</svg>")) {
    throw new BrandAssetValidationError("INVALID_SVG");
  }
  return new TextEncoder().encode(sanitized);
}

export function validateBrandAsset(input: AssetValidationInput): AssetValidationResult {
  assertSize(input.bytes);
  const extension = normalizedExtension(input.filename);
  const mimeType = input.mimeType.trim().toLowerCase();

  if (
    (extension === ".png" && mimeType !== "image/png") ||
    (extension === ".svg" && mimeType !== "image/svg+xml")
  ) {
    throw new BrandAssetValidationError("INVALID_MIME_TYPE");
  }

  let bytes: Uint8Array;
  if (extension === ".png") {
    if (!Buffer.from(input.bytes.subarray(0, PNG_SIGNATURE.length)).equals(PNG_SIGNATURE)) {
      throw new BrandAssetValidationError("INVALID_MAGIC_BYTES");
    }
    bytes = input.bytes;
  } else {
    bytes = sanitizeSvg(input.bytes);
  }

  const supportedMimeType: SupportedBrandAssetMimeType =
    extension === ".png" ? "image/png" : "image/svg+xml";

  return {
    bytes,
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    extension,
    mimeType: supportedMimeType,
  };
}
