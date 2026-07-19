import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildPrintExportBundle } from "./print-export.js";
import { renderSticker } from "./render.js";

describe("print export bundle", () => {
  it("builds PDF, CSV, ZIP, and checksum manifest without secret fields", async () => {
    const logo = await readFile(
      new URL("../../../apps/web/public/brand/taptolk-logo.png", import.meta.url),
    );
    const rendered = await renderSticker({
      publicUrl: "https://taptolk.example/q/export-test",
      taptolkLogoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
      templateCode: "ROUND_WHITE_MINIMAL_V1",
    });
    const bundle = await buildPrintExportBundle("BATCH_TEST_001", [
      {
        humanCode: "0123456789",
        ordinal: 1,
        previewPng: rendered.png,
        printSvg: rendered.svg,
        renderChecksumSha256: rendered.checksumSha256,
      },
    ]);
    expect(Buffer.from(bundle.pdf.bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const document = await PDFDocument.load(bundle.pdf.bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getPage(0).getSize()).toEqual({
      height: 841.89,
      width: 595.28,
    });
    expect(new TextDecoder().decode(bundle.csv.bytes)).toContain("human_code");
    expect(new TextDecoder().decode(bundle.manifest.bytes)).not.toMatch(
      /activation|ciphertext|publicToken/iu,
    );
    expect(Object.keys(unzipSync(bundle.zip.bytes)).sort()).toEqual([
      "BATCH_TEST_001-checksums.json",
      "BATCH_TEST_001-manifest.csv",
      "BATCH_TEST_001-print.pdf",
      "preview/00001.png",
      "svg/00001.svg",
    ]);
    expect(
      [bundle.csv, bundle.manifest, bundle.pdf, bundle.zip].every((item) =>
        /^[0-9a-f]{64}$/u.test(item.checksumSha256),
      ),
    ).toBe(true);
  }, 20_000);
});
