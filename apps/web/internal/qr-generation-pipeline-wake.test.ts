import { describe, expect, it } from "vitest";
import { parseQrGenerationPipelineWake } from "./qr-generation-pipeline-contract";

describe("QR generation pipeline wake", () => {
  it("accepts the redacted versioned wake contract", () => {
    expect(
      parseQrGenerationPipelineWake({
        batchId: "00000000-0000-4000-8000-000000000001",
        requestId: "00000000-0000-4000-8000-000000000002",
        schemaVersion: 1,
      }),
    ).toEqual({
      batchId: "00000000-0000-4000-8000-000000000001",
      requestId: "00000000-0000-4000-8000-000000000002",
      schemaVersion: 1,
    });
  });

  it("rejects credentials and unknown fields", () => {
    expect(() =>
      parseQrGenerationPipelineWake({
        batchId: "00000000-0000-4000-8000-000000000001",
        publicToken: "must-not-enter-the-queue",
        requestId: "00000000-0000-4000-8000-000000000002",
        schemaVersion: 1,
      }),
    ).toThrow();
  });
});
