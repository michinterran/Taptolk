import { describe, expect, it } from "vitest";
import {
  BrandAssetValidationError,
  inspectBrandAsset,
  sanitizeSvg,
  validateBrandAsset,
} from "./brand-assets.js";

const encoder = new TextEncoder();

describe("brand asset validation", () => {
  it("sanitizes passive SVG and returns its checksum", () => {
    const result = validateBrandAsset({
      bytes: encoder.encode(
        '<?xml version="1.0"?><!--note--><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>',
      ),
      filename: "logo.svg",
      mimeType: "image/svg+xml",
    });
    expect(new TextDecoder().decode(result.bytes)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>',
    );
    expect(result.checksumSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path onclick="alert(1)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
  ])("rejects active SVG content", (source) => {
    expect(() => sanitizeSvg(encoder.encode(source))).toThrowError(
      new BrandAssetValidationError("ACTIVE_SVG_CONTENT"),
    );
  });

  it("verifies PNG magic bytes independently from MIME", () => {
    expect(() =>
      validateBrandAsset({
        bytes: encoder.encode("not a png"),
        filename: "logo.png",
        mimeType: "image/png",
      }),
    ).toThrowError(new BrandAssetValidationError("INVALID_MAGIC_BYTES"));
  });

  it("rejects assets below the minimum usable logo dimensions", async () => {
    const tiny = await import("sharp").then(({ default: sharp }) =>
      sharp({
        create: {
          background: "#ffffff",
          channels: 4,
          height: 16,
          width: 16,
        },
      })
        .png()
        .toBuffer(),
    );
    await expect(
      inspectBrandAsset({
        bytes: tiny,
        filename: "tiny.png",
        mimeType: "image/png",
      }),
    ).rejects.toThrowError(new BrandAssetValidationError("INVALID_DIMENSIONS"));
  });
});
