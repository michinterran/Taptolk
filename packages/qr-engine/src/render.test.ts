import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { renderDynamicQr, renderSticker, STICKER_TEMPLATES } from "./render.js";

describe("sticker rendering", () => {
  it("renders a QR-only SVG without sticker artwork or logos", async () => {
    const publicUrl = "https://taptolk.example/q/qr-only-token";
    const result = await renderDynamicQr({ publicUrl });

    expect(result.decodedValue).toBe(publicUrl);
    expect(result.svg).toContain("<svg");
    expect(result.svg).not.toContain("holo-base");
    expect(result.svg).not.toContain("taptolk");
    expect(result.svg).not.toContain("<image");
  }, 20_000);

  it("declares the four required immutable template codes", () => {
    expect(Object.keys(STICKER_TEMPLATES)).toEqual([
      "ROUND_BLUE_HOLOGRAM_V1",
      "ROUND_PURPLE_GRADIENT_V1",
      "ROUND_WHITE_MINIMAL_V1",
      "SQUARE_DARK_PREMIUM_V1",
    ]);
  });

  it("renders and decodes the public URL from the generated PNG", async () => {
    const logo = await readFile(
      new URL("../../../apps/web/public/brand/taptolk-logo.png", import.meta.url),
    );
    const result = await renderSticker({
      publicUrl: "https://taptolk.example/q/test-token",
      taptolkLogoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
      templateCode: "ROUND_WHITE_MINIMAL_V1",
    });
    expect(result.decodedValue).toBe("https://taptolk.example/q/test-token");
    expect(result.svg).toContain('x="230" y="245" width="540" height="540"');
    expect(result.svg).toContain('x="300" y="840" width="400" height="90"');
    expect(result.checksumSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.png.byteLength).toBeGreaterThan(1_000);
  }, 20_000);

  it("keeps the holographic face decodable and preserves the QR panel and Taptolk mark", async () => {
    const logo = await readFile(
      new URL("../../../apps/web/public/brand/taptolk-logo.png", import.meta.url),
    );
    const result = await renderSticker({
      publicUrl: "https://taptolk.example/q/hologram-token",
      taptolkLogoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
      templateCode: "ROUND_BLUE_HOLOGRAM_V1",
    });
    // The decode is the contract: iridescent facets must never reduce QR contrast.
    expect(result.decodedValue).toBe("https://taptolk.example/q/hologram-token");
    expect(result.svg).toContain('fill="url(#holo-base)"');
    // The QR sits on the solid white panel and the immutable Taptolk mark keeps its box.
    expect(result.svg).toContain('x="230" y="245" width="540" height="540"');
    expect(result.svg).toContain('x="300" y="840" width="400" height="90"');
  }, 20_000);
});
