import { describe, expect, it, vi } from "vitest";
import type { QueueJob } from "../queue-consumer.js";
import {
  type QrGenerationCommitItem,
  type QrGenerationExecutionContext,
  type QrGenerationExecutionRepository,
  QrGenerationHandler,
} from "./qr-generation-handler.js";

const job: QueueJob = {
  batchId: "00000000-0000-4000-8000-000000000201",
  createdAt: "2026-07-19T06:00:00.000Z",
  deliveryAttempt: 1,
  generationRevision: 1,
  jobId: "00000000-0000-4000-8000-000000000101",
  jobType: "QR_GENERATION",
  schemaVersion: 1,
  siteId: "00000000-0000-4000-8000-000000000301",
  tenantId: "00000000-0000-4000-8000-000000000401",
  traceId: "00000000-0000-4000-8000-000000000501",
};

function context(
  requestedQuantity: number,
  completedOrdinals: readonly number[] = [],
): QrGenerationExecutionContext {
  return {
    alreadyCompleted: false,
    batchId: job.batchId,
    completedOrdinals,
    generationRevision: 1,
    jobId: job.jobId,
    managementCompanyId: "00000000-0000-4000-8000-000000000601",
    requestedQuantity,
    siteId: job.siteId,
    stickerDesignVersionId: "00000000-0000-4000-8000-000000000701",
    templateCode: "ROUND_WHITE_MINIMAL_V1",
    tenantId: job.tenantId,
  };
}

function setup(target: QrGenerationExecutionContext) {
  const committed = new Map<number, QrGenerationCommitItem>();
  const repository: QrGenerationExecutionRepository = {
    commitChunk: vi.fn(async ({ items }) => {
      let committedCount = 0;
      for (const item of items) {
        if (!committed.has(item.ordinal)) {
          committed.set(item.ordinal, item);
          committedCount += 1;
        }
      }
      return { committedCount, totalCount: committed.size + target.completedOrdinals.length };
    }),
    complete: vi.fn(async () => ({
      completedCount: committed.size + target.completedOrdinals.length,
    })),
    start: vi.fn(async () => target),
  };
  const renderer = {
    render: vi.fn(async ({ publicUrl }: { publicUrl: string }) => ({
      checksumSha256: "a".repeat(64),
      decodedValue: publicUrl,
      png: new Uint8Array([1, 2, 3]),
      svg: "<svg/>",
    })),
  };
  const handler = new QrGenerationHandler(
    repository,
    {
      store: vi.fn(async ({ ordinal }) => ({
        previewPngPath: `preview/${ordinal}.png`,
        printSvgPath: `print/${ordinal}.svg`,
        renderChecksumSha256: ordinal.toString(16).padStart(64, "0"),
      })),
    },
    renderer,
    {
      encryptionKey: Buffer.alloc(32, 9),
      keyVersion: 1,
      publicQrBaseUrl: "https://taptolk.example",
      renderConcurrency: 2,
      taptolkLogoDataUri: `data:image/png;base64,${Buffer.from("logo").toString("base64")}`,
    },
  );
  return { committed, handler, renderer, repository };
}

describe("QR generation handler", () => {
  it("generates 1,000 unique credentials in bounded resumable chunks", async () => {
    const { committed, handler, repository } = setup(context(1_000));
    await expect(handler.handle(job)).resolves.toEqual({
      completedCount: 1_000,
      generatedThisRun: 1_000,
    });
    expect(repository.commitChunk).toHaveBeenCalledTimes(20);
    expect(new Set([...committed.values()].map((item) => item.publicTokenHash))).toHaveLength(
      1_000,
    );
    expect(new Set([...committed.values()].map((item) => item.humanCode))).toHaveLength(1_000);
    expect(new Set([...committed.values()].map((item) => item.activationCodeHash))).toHaveLength(
      1_000,
    );
  });

  it("resumes only missing ordinals after interruption", async () => {
    const completedOrdinals = Array.from({ length: 400 }, (_, index) => index + 1);
    const { committed, handler, repository } = setup(context(1_000, completedOrdinals));
    await expect(handler.handle(job)).resolves.toEqual({
      completedCount: 1_000,
      generatedThisRun: 600,
    });
    expect(repository.commitChunk).toHaveBeenCalledTimes(12);
    expect(Math.min(...committed.keys())).toBe(401);
    expect(Math.max(...committed.keys())).toBe(1_000);
  });

  it("bounds render and Storage preparation concurrency inside each durable chunk", async () => {
    const { handler, renderer } = setup(context(12));
    let activeRenders = 0;
    let maximumActiveRenders = 0;
    renderer.render.mockImplementation(async ({ publicUrl }) => {
      activeRenders += 1;
      maximumActiveRenders = Math.max(maximumActiveRenders, activeRenders);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeRenders -= 1;
      return {
        checksumSha256: "a".repeat(64),
        decodedValue: publicUrl,
        png: new Uint8Array([1, 2, 3]),
        svg: "<svg/>",
      };
    });

    await handler.handle(job);

    expect(maximumActiveRenders).toBe(2);
  });

  it("does not duplicate work for an already completed job", async () => {
    const target = {
      ...context(
        1_000,
        Array.from({ length: 1_000 }, (_, index) => index + 1),
      ),
      alreadyCompleted: true,
    };
    const { handler, repository } = setup(target);
    await expect(handler.handle(job)).resolves.toEqual({
      completedCount: 1_000,
      generatedThisRun: 0,
    });
    expect(repository.commitChunk).not.toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("renders bulk assets with the approved optional customer logo", async () => {
    const customerLogoDataUri = `data:image/png;base64,${Buffer.from("customer").toString(
      "base64",
    )}`;
    const { handler, renderer } = setup({
      ...context(1),
      customerLogoDataUri,
    });
    await handler.handle(job);
    expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({ customerLogoDataUri }));
  });
});
