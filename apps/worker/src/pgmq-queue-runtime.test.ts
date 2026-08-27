import { describe, expect, it, vi } from "vitest";
import {
  QrWorkerExecutionError,
  runQrQueueIteration,
  SupabasePgmqQueue,
} from "./pgmq-queue-runtime.js";

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

function queue(readCount = 1) {
  return {
    archive: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue({ message: job, messageId: "42", readCount }),
  };
}

function execution() {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    recordGenerationFailure: vi.fn().mockResolvedValue({ terminal: false }),
    recordPrintExportFailure: vi.fn().mockResolvedValue(undefined),
  };
}

describe("PGMQ worker runtime", () => {
  it("archives only after generation and export complete", async () => {
    const target = queue();
    const runner = execution();
    await expect(runQrQueueIteration(target, runner, 5)).resolves.toEqual({
      messageId: "42",
      status: "COMPLETED",
    });
    expect(target.archive).toHaveBeenCalledWith("42");
  });

  it("leaves a retryable generation message in the queue", async () => {
    const target = queue();
    const runner = execution();
    runner.execute.mockRejectedValue(new QrWorkerExecutionError("GENERATION_UNAVAILABLE"));
    await expect(runQrQueueIteration(target, runner, 5)).resolves.toEqual({
      messageId: "42",
      status: "RETRY",
    });
    expect(runner.recordGenerationFailure).toHaveBeenCalledWith(job, "GENERATION_UNAVAILABLE");
    expect(target.archive).not.toHaveBeenCalled();
  });

  it("terminates and archives an exhausted print export", async () => {
    const target = queue(5);
    const runner = execution();
    runner.execute.mockRejectedValue(new QrWorkerExecutionError("PRINT_EXPORT_UNAVAILABLE"));
    await expect(runQrQueueIteration(target, runner, 5)).resolves.toEqual({
      messageId: "42",
      status: "REJECTED",
    });
    expect(runner.recordPrintExportFailure).toHaveBeenCalledWith(job.batchId);
    expect(target.archive).toHaveBeenCalledWith("42");
  });

  it("maps pgmq_public read and archive without exposing message payloads", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ message: job, msg_id: 42, read_ct: 2 }],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const target = new SupabasePgmqQueue(
      { schema: vi.fn().mockReturnValue({ rpc }) },
      "qr-generation",
      3600,
    );
    await expect(target.read()).resolves.toEqual({
      message: job,
      messageId: "42",
      readCount: 2,
    });
    await expect(target.archive("42")).resolves.toBeUndefined();
    expect(rpc).toHaveBeenNthCalledWith(1, "read", {
      n: 1,
      queue_name: "qr-generation",
      sleep_seconds: 3600,
    });
  });
});
