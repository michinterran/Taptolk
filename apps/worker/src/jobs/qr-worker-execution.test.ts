import { describe, expect, it, vi } from "vitest";
import { QrWorkerExecutionRuntime } from "./qr-worker-execution.js";

const job = {
  batchId: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-07-19T09:00:00.000Z",
  deliveryAttempt: 1,
  generationRevision: 1,
  jobId: "22222222-2222-4222-8222-222222222222",
  jobType: "QR_GENERATION" as const,
  schemaVersion: 1 as const,
  siteId: "33333333-3333-4333-8333-333333333333",
  tenantId: "44444444-4444-4444-8444-444444444444",
  traceId: "55555555-5555-4555-8555-555555555555",
};

describe("QrWorkerExecutionRuntime", () => {
  it("runs print export only after generation completes", async () => {
    const generation = { handle: vi.fn().mockResolvedValue({ completedCount: 1 }) };
    const printExport = { handle: vi.fn().mockResolvedValue({ exportCount: 4 }) };
    const runtime = new QrWorkerExecutionRuntime(generation as never, printExport as never, {
      recordGenerationFailure: vi.fn(),
      recordPrintExportFailure: vi.fn(),
    });
    await expect(runtime.execute(job)).resolves.toBeUndefined();
    expect(generation.handle).toHaveBeenCalledBefore(printExport.handle);
  });

  it("reduces print provider details to one allowlisted code", async () => {
    const runtime = new QrWorkerExecutionRuntime(
      { handle: vi.fn().mockResolvedValue({ completedCount: 1 }) } as never,
      { handle: vi.fn().mockRejectedValue(new Error("provider payload")) } as never,
      {
        recordGenerationFailure: vi.fn(),
        recordPrintExportFailure: vi.fn(),
      },
    );
    await expect(runtime.execute(job)).rejects.toMatchObject({
      code: "PRINT_EXPORT_UNAVAILABLE",
    });
  });
});
