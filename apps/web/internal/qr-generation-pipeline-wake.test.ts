import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@vercel/queue", () => ({
  send: mocks.send,
}));

import { enqueueQrGenerationPipelineWake } from "./qr-generation-pipeline-wake";

const originalAppEnv = process.env.APP_ENV;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_ENV = "staging";
  mocks.send.mockResolvedValue(undefined);
});

afterEach(() => {
  if (originalAppEnv === undefined) {
    delete process.env.APP_ENV;
  } else {
    process.env.APP_ENV = originalAppEnv;
  }
});

describe("QR generation pipeline wake", () => {
  it("uses the request and batch together for Queue idempotency", async () => {
    const requestId = "00000000-0000-4000-8000-000000000001";
    const batchId = "00000000-0000-4000-8000-000000000002";

    await enqueueQrGenerationPipelineWake({ batchId, requestId });

    expect(mocks.send).toHaveBeenCalledWith(
      "qr-generation-pipeline-v1",
      {
        batchId,
        requestId,
        schemaVersion: 1,
      },
      {
        delaySeconds: 5,
        idempotencyKey: `qr-generation-approval-${requestId}-${batchId}`,
        retentionSeconds: 86_400,
      },
    );
  });
});
