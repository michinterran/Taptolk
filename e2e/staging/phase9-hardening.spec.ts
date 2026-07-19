import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  buildPrintExportBundle,
  decodeQrFromImage,
  inspectPrintPdf,
  renderSticker,
  STICKER_TEMPLATES,
} from "@taptolk/qr-engine";

test.describe("Phase 9 bounded hardening gates", () => {
  test("100-request health load has zero errors and reviewed security headers", async ({
    request,
  }) => {
    await expect((await request.get("/api/health")).status()).toBe(200);
    const durations: number[] = [];
    let errors = 0;
    for (let offset = 0; offset < 100; offset += 10) {
      const results = await Promise.all(
        Array.from({ length: 10 }, async () => {
          const startedAt = performance.now();
          const response = await request.get("/api/health");
          return { duration: performance.now() - startedAt, response };
        }),
      );
      for (const { duration, response } of results) {
        durations.push(duration);
        if (response.status() !== 200) {
          errors += 1;
        }
        expect(response.headers()).toMatchObject({
          "cache-control": "no-store",
          "permissions-policy": "camera=(), microphone=(), geolocation=()",
          "referrer-policy": "strict-origin-when-cross-origin",
          "x-content-type-options": "nosniff",
          "x-frame-options": "DENY",
        });
        expect(await response.text()).not.toMatch(
          /authorization|cookie|phone|message|otp|token|secret|password/iu,
        );
      }
    }
    durations.sort((left, right) => left - right);
    const p95 = durations[Math.floor(durations.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
    expect(errors).toBe(0);
    expect(p95).toBeLessThan(2_000);
  });

  test("100-item print source stays 85mm, decodes 100%, and has valid checksums", async () => {
    test.setTimeout(8 * 60_000);
    const logo = await readFile("apps/web/public/brand/taptolk-logo.png");
    const publicUrl = "https://taptolk.example/q/phase9-print-source";
    const rendered = await renderSticker({
      publicUrl,
      taptolkLogoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
      templateCode: "ROUND_WHITE_MINIMAL_V1",
    });
    const decoded = await Promise.all(
      Array.from({ length: 100 }, () => decodeQrFromImage(rendered.png)),
    );
    expect(decoded.filter((value) => value === publicUrl)).toHaveLength(100);
    expect(
      Object.values(STICKER_TEMPLATES).every(
        (template) => template.heightMm === 85 && template.widthMm === 85,
      ),
    ).toBe(true);

    const bundle = await buildPrintExportBundle(
      "PHASE9_PRINT_100",
      Array.from({ length: 100 }, (_, index) => ({
        humanCode: String(index + 1).padStart(10, "0"),
        ordinal: index + 1,
        previewPng: rendered.png,
        printSvg: rendered.svg,
        renderChecksumSha256: rendered.checksumSha256,
      })),
    );
    const inspection = await inspectPrintPdf(bundle.pdf.bytes);
    expect(inspection.pageCount).toBe(17);
    expect(
      inspection.pages.every(
        ({ height, width }) => Math.abs(height - 841.89) < 0.01 && Math.abs(width - 595.28) < 0.01,
      ),
    ).toBe(true);
    const manifestText = new TextDecoder().decode(bundle.manifest.bytes);
    expect(JSON.parse(manifestText)).toMatchObject({ itemCount: 100, schemaVersion: 1 });
    expect(manifestText).not.toMatch(
      /activation|authorization|ciphertext|cookie|phone|publicToken|secret/iu,
    );
    for (const artifact of [bundle.csv, bundle.manifest, bundle.pdf, bundle.zip]) {
      expect(createHash("sha256").update(artifact.bytes).digest("hex")).toBe(
        artifact.checksumSha256,
      );
    }
  });
});
