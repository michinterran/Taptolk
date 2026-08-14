import type { QrGenerationDispatchRuntimeResult } from "@taptolk/application";
import type { QrQueueWorkerRuntimeInitialization } from "@taptolk/worker";
import { describe, expect, it, vi } from "vitest";
import type { StagingQrGenerationDispatchRuntimeConfiguration } from "./qr-generation-dispatch-configuration";
import {
  handleQrGenerationPipelineMessage,
  QrGenerationPipelineConfigurationError,
  type QrGenerationPipelineHandlerDependencies,
  QrGenerationPipelineRetryError,
} from "./qr-generation-pipeline-handler";

const wake = {
  batchId: "00000000-0000-4000-8000-000000000001",
  requestId: "00000000-0000-4000-8000-000000000002",
  schemaVersion: 1,
};

const configuration: StagingQrGenerationDispatchRuntimeConfiguration = {
  publisher: { queueName: "qr-generation", requestTimeoutMs: 3_000 },
  retry: { baseDelayMs: 5_000, jitterRatio: 0.2, maxDelayMs: 300_000 },
  runtime: { claimLimit: 10, durationBudgetMs: 8_000, leaseSeconds: 60 },
};

function dispatchResult(claimedCount: number): QrGenerationDispatchRuntimeResult {
  return {
    claimedCount,
    completedWithinBudget: true,
    outcomeCounts: {
      DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING: 0,
      DELIVERY_RETRY_SCHEDULED: 0,
      PUBLICATION_ACKNOWLEDGEMENT_PENDING: 0,
      PUBLISHED: claimedCount,
    },
  };
}

function dependencies(input: {
  claimedCount?: number;
  configuration?: StagingQrGenerationDispatchRuntimeConfiguration | null;
  worker?: QrQueueWorkerRuntimeInitialization;
}): QrGenerationPipelineHandlerDependencies {
  const worker: QrQueueWorkerRuntimeInitialization =
    input.worker ??
    ({ ready: true, runOnce: vi.fn(async () => ({ status: "EMPTY" as const })) } as const);
  return {
    createWorkerRuntime: vi.fn(async () => worker),
    readDispatchConfiguration: vi.fn(() =>
      input.configuration === undefined ? configuration : input.configuration,
    ),
    runDispatch: vi.fn(async () => dispatchResult(input.claimedCount ?? 0)),
  };
}

describe("Vercel QR generation pipeline handler", () => {
  it("fails closed when staging runtime configuration is unavailable", async () => {
    await expect(
      handleQrGenerationPipelineMessage(
        wake,
        { deliveryCount: 1 },
        dependencies({ configuration: null }),
      ),
    ).rejects.toBeInstanceOf(QrGenerationPipelineConfigurationError);
  });

  it("returns only missing variable names when worker configuration is unavailable", async () => {
    await expect(
      handleQrGenerationPipelineMessage(
        wake,
        { deliveryCount: 1 },
        dependencies({
          worker: { missingVariables: ["PUBLIC_QR_BASE_URL"], ready: false },
        }),
      ),
    ).rejects.toMatchObject({
      missingVariables: ["PUBLIC_QR_BASE_URL"],
    });
  });

  it("retries an early wake until the approval transaction becomes visible", async () => {
    await expect(
      handleQrGenerationPipelineMessage(wake, { deliveryCount: 1 }, dependencies({})),
    ).rejects.toEqual(new QrGenerationPipelineRetryError("NO_WORK_YET"));
  });

  it("acknowledges a bounded no-op wake after the approval retry window", async () => {
    await expect(
      handleQrGenerationPipelineMessage(wake, { deliveryCount: 5 }, dependencies({})),
    ).resolves.toEqual({ dispatchClaimedCount: 0, workerStatus: "EMPTY" });
  });

  it("requests Vercel redelivery when the Supabase worker asks to retry", async () => {
    await expect(
      handleQrGenerationPipelineMessage(
        wake,
        { deliveryCount: 1 },
        dependencies({
          claimedCount: 1,
          worker: {
            ready: true,
            runOnce: vi.fn(async () => ({ messageId: "1", status: "RETRY" as const })),
          },
        }),
      ),
    ).rejects.toEqual(new QrGenerationPipelineRetryError("WORKER_RETRY"));
  });

  it("completes after dispatching and consuming one Supabase Queue message", async () => {
    await expect(
      handleQrGenerationPipelineMessage(
        wake,
        { deliveryCount: 1 },
        dependencies({
          claimedCount: 1,
          worker: {
            ready: true,
            runOnce: vi.fn(async () => ({ messageId: "1", status: "COMPLETED" as const })),
          },
        }),
      ),
    ).resolves.toEqual({ dispatchClaimedCount: 1, workerStatus: "COMPLETED" });
  });
});
