import {
  ExponentialQrGenerationDeliveryRetryPolicy,
  QrGenerationDispatchCoordinator,
  QrGenerationDispatcherService,
  type QrGenerationQueueMessage,
  QrGenerationQueuePublisherError,
} from "@taptolk/application";
import { describe, expect, it, vi } from "vitest";
import {
  createQrGenerationDispatcherRpcRepository,
  type QrGenerationDispatcherRpcClient,
} from "./qr-generation-dispatcher-rpc-repository.js";

const JOB_ID = "00000000-0000-4000-8000-000000000101";
const BATCH_ID = "00000000-0000-4000-8000-000000000201";
const SITE_ID = "00000000-0000-4000-8000-000000000301";
const TENANT_ID = "00000000-0000-4000-8000-000000000401";
const CLAIM = {
  batchId: BATCH_ID,
  createdAt: "2026-07-19T06:00:00.000Z",
  deliveryAttemptCount: 1,
  generationRevision: 1,
  jobId: JOB_ID,
  jobStatus: "DELIVERY_LEASED",
  jobType: "QR_GENERATION",
  jobVersion: 2,
  leaseExpiresAt: "2026-07-19T06:00:30.000Z",
  siteId: SITE_ID,
  tenantId: TENANT_ID,
};
const NOW = new Date("2026-07-19T06:00:00.000Z");

function retryPolicy() {
  return new ExponentialQrGenerationDeliveryRetryPolicy(
    {
      baseDelayMs: 5_000,
      jitterRatio: 0,
      maxDelayMs: 60_000,
    },
    () => NOW,
    () => 0.5,
  );
}

function claimResponse() {
  return {
    data: { jobs: [CLAIM] },
    error: null,
  };
}

describe("provider-neutral QR generation dispatch pipeline", () => {
  it("connects claim, strict Queue DTO, publish, and atomic acknowledgement", async () => {
    const rpc: QrGenerationDispatcherRpcClient["rpc"] = vi.fn(async (functionName, _parameters) => {
      if (functionName === "claim_pending_qr_generation_jobs") {
        return claimResponse();
      }
      if (functionName === "record_qr_generation_job_published") {
        return {
          data: {
            batchId: BATCH_ID,
            batchStatus: "GENERATION_QUEUED",
            batchVersion: 4,
            deliveryAttemptCount: 1,
            jobId: JOB_ID,
            jobStatus: "QUEUED",
            jobVersion: 3,
          },
          error: null,
        };
      }
      throw new Error("Unexpected failure acknowledgement.");
    });
    const publish = vi.fn(
      async (_message: QrGenerationQueueMessage): Promise<{ queueMessageId: string }> => ({
        queueMessageId: "pgmq:qr-generation.42",
      }),
    );
    const repository = createQrGenerationDispatcherRpcRepository({ rpc });
    const coordinator = new QrGenerationDispatchCoordinator(
      new QrGenerationDispatcherService(repository, () => NOW),
      { publish },
      retryPolicy(),
    );

    await expect(coordinator.runOnce({ leaseSeconds: 30, limit: 10 })).resolves.toEqual({
      claimedCount: 1,
      outcomes: [{ jobId: JOB_ID, status: "PUBLISHED" }],
    });
    expect(publish).toHaveBeenCalledWith({
      batchId: BATCH_ID,
      createdAt: CLAIM.createdAt,
      deliveryAttempt: 1,
      generationRevision: 1,
      jobId: JOB_ID,
      jobType: "QR_GENERATION",
      schemaVersion: 1,
      siteId: SITE_ID,
      tenantId: TENANT_ID,
      traceId: JOB_ID,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "claim_pending_qr_generation_jobs", {
      p_lease_seconds: 30,
      p_limit: 10,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "record_qr_generation_job_published", {
      p_expected_version: 2,
      p_job_id: JOB_ID,
      p_queue_message_id: "pgmq:qr-generation.42",
    });
  });

  it("connects a provider failure to redacted exponential retry scheduling", async () => {
    const rpc: QrGenerationDispatcherRpcClient["rpc"] = vi.fn(async (functionName, _parameters) => {
      if (functionName === "claim_pending_qr_generation_jobs") {
        return claimResponse();
      }
      if (functionName === "record_qr_generation_delivery_failure") {
        return {
          data: {
            batchId: BATCH_ID,
            batchStatus: "GENERATION_APPROVED",
            batchVersion: 3,
            deliveryAttemptCount: 1,
            jobId: JOB_ID,
            jobStatus: "RETRY_WAIT",
            jobVersion: 3,
          },
          error: null,
        };
      }
      throw new Error("Unexpected publication acknowledgement.");
    });
    const publish = vi
      .fn()
      .mockRejectedValue(new QrGenerationQueuePublisherError("QUEUE_RATE_LIMITED"));
    const repository = createQrGenerationDispatcherRpcRepository({ rpc });
    const coordinator = new QrGenerationDispatchCoordinator(
      new QrGenerationDispatcherService(repository, () => NOW),
      { publish },
      retryPolicy(),
    );

    await expect(coordinator.runOnce({ leaseSeconds: 30, limit: 1 })).resolves.toEqual({
      claimedCount: 1,
      outcomes: [{ jobId: JOB_ID, status: "DELIVERY_RETRY_SCHEDULED" }],
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "record_qr_generation_delivery_failure", {
      p_available_at: "2026-07-19T06:00:05.000Z",
      p_error_code: "QUEUE_RATE_LIMITED",
      p_expected_version: 2,
      p_job_id: JOB_ID,
    });
  });

  it("does not write false provider failure after publish acknowledgement persistence fails", async () => {
    const rpc: QrGenerationDispatcherRpcClient["rpc"] = vi.fn(async (functionName, _parameters) => {
      if (functionName === "claim_pending_qr_generation_jobs") {
        return claimResponse();
      }
      if (functionName === "record_qr_generation_job_published") {
        return {
          data: null,
          error: {
            code: "P0001",
            message: "database unavailable",
          },
        };
      }
      throw new Error("Delivery failure acknowledgement must not run.");
    });
    const repository = createQrGenerationDispatcherRpcRepository({ rpc });
    const coordinator = new QrGenerationDispatchCoordinator(
      new QrGenerationDispatcherService(repository, () => NOW),
      {
        publish: vi.fn().mockResolvedValue({
          queueMessageId: "pgmq:qr-generation.42",
        }),
      },
      retryPolicy(),
    );

    await expect(coordinator.runOnce({ leaseSeconds: 30, limit: 1 })).resolves.toEqual({
      claimedCount: 1,
      outcomes: [
        {
          jobId: JOB_ID,
          status: "PUBLICATION_ACKNOWLEDGEMENT_PENDING",
        },
      ],
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalledWith(
      "record_qr_generation_delivery_failure",
      expect.anything(),
    );
  });
});
