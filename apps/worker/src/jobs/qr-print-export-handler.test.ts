import { readFile } from "node:fs/promises";
import { renderSticker } from "@taptolk/qr-engine";
import { describe, expect, it, vi } from "vitest";
import {
  type QrPrintExportArtifactStorage,
  QrPrintExportHandler,
  type QrPrintExportRepository,
} from "./qr-print-export-handler.js";

describe("QR print export handler", () => {
  it("loads quality artifacts, stores four exports, and commits their checksums", async () => {
    const logo = await readFile(
      new URL("../../../web/public/brand/taptolk-logo.png", import.meta.url),
    );
    const rendered = await renderSticker({
      publicUrl: "https://taptolk.example/q/print-handler",
      taptolkLogoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
      templateCode: "ROUND_WHITE_MINIMAL_V1",
    });
    const files = new Map<string, Uint8Array>([
      ["preview/1.png", rendered.png],
      ["svg/1.svg", new TextEncoder().encode(rendered.svg)],
    ]);
    let activeStores = 0;
    let maxActiveStores = 0;
    const repository: QrPrintExportRepository = {
      commit: vi.fn(async () => undefined),
      getContext: vi.fn(async () => ({
        alreadyCompleted: false,
        batchCode: "BATCH_EXPORT_001",
        batchId: "00000000-0000-4000-8000-000000000001",
        exportRevision: 1,
        items: [
          {
            humanCode: "0123456789",
            ordinal: 1,
            previewPngPath: "preview/1.png",
            printSvgPath: "svg/1.svg",
            renderChecksumSha256: rendered.checksumSha256,
          },
        ],
        siteId: "00000000-0000-4000-8000-000000000002",
        tenantId: "00000000-0000-4000-8000-000000000003",
      })),
    };
    const storage: QrPrintExportArtifactStorage = {
      load: vi.fn(async (path) => {
        const value = files.get(path);
        if (!value) {
          throw new Error("missing");
        }
        return value;
      }),
      store: vi.fn(async ({ artifact }) => {
        activeStores += 1;
        maxActiveStores = Math.max(maxActiveStores, activeStores);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeStores -= 1;
        return `exports/${artifact.filename}`;
      }),
    };
    const handler = new QrPrintExportHandler(repository, storage, {
      loadConcurrency: 2,
      storeConcurrency: 1,
    });

    await expect(handler.handle("00000000-0000-4000-8000-000000000001")).resolves.toEqual({
      exportCount: 4,
      itemCount: 1,
    });
    expect(storage.store).toHaveBeenCalledTimes(4);
    expect(maxActiveStores).toBe(1);
    expect(repository.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        exports: expect.arrayContaining([
          expect.objectContaining({ exportType: "PDF" }),
          expect.objectContaining({ exportType: "CSV" }),
          expect.objectContaining({ exportType: "ZIP" }),
          expect.objectContaining({ exportType: "MANIFEST" }),
        ]),
      }),
    );
  }, 20_000);
});
