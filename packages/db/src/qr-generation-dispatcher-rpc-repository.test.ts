import { describe, expect, it, vi } from "vitest";
import {
  createQrGenerationDispatcherRpcRepository,
  type QrGenerationDispatcherRpcClient,
  QrGenerationDispatcherRpcRepositoryError,
} from "./qr-generation-dispatcher-rpc-repository.js";

const JOB_ID = "00000000-0000-4000-8000-000000000101";
const BATCH_ID = "00000000-0000-4000-8000-000000000201";
const SITE_ID = "00000000-0000-4000-8000-000000000301";
const TENANT_ID = "00000000-0000-4000-8000-000000000401";

function client(data: unknown): QrGenerationDispatcherRpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

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

describe("QR generation dispatcher RPC repository", () => {
  it("claims and reduces server-only RPC rows to the allowlisted DTO", async () => {
    const target = client({
      jobs: [
        {
          ...CLAIM,
          approvalRequestId: "must-not-cross",
          queueMessageId: "must-not-cross",
        },
      ],
    });
    const repository = createQrGenerationDispatcherRpcRepository(target);

    await expect(repository.claimPending({ leaseSeconds: 30, limit: 10 })).resolves.toEqual([
      CLAIM,
    ]);
    expect(target.rpc).toHaveBeenCalledWith("claim_pending_qr_generation_jobs", {
      p_lease_seconds: 30,
      p_limit: 10,
    });
  });

  it("records publication using only the reviewed RPC parameters", async () => {
    const data = {
      batchId: BATCH_ID,
      batchStatus: "GENERATION_QUEUED",
      batchVersion: 4,
      deliveryAttemptCount: 1,
      jobId: JOB_ID,
      jobStatus: "QUEUED",
      jobVersion: 3,
      queueMessageId: "must-not-return",
    };
    const target = client(data);
    const repository = createQrGenerationDispatcherRpcRepository(target);

    await expect(
      repository.recordPublished({
        expectedVersion: 2,
        jobId: JOB_ID,
        queueMessageId: "pgmq:qr-generation.42",
      }),
    ).resolves.toEqual({
      batchId: BATCH_ID,
      batchStatus: "GENERATION_QUEUED",
      batchVersion: 4,
      deliveryAttemptCount: 1,
      jobId: JOB_ID,
      jobStatus: "QUEUED",
      jobVersion: 3,
    });
    expect(target.rpc).toHaveBeenCalledWith("record_qr_generation_job_published", {
      p_expected_version: 2,
      p_job_id: JOB_ID,
      p_queue_message_id: "pgmq:qr-generation.42",
    });
  });

  it("records a redacted retry using only the reviewed RPC parameters", async () => {
    const target = client({
      batchId: BATCH_ID,
      batchStatus: "GENERATION_APPROVED",
      batchVersion: 3,
      deliveryAttemptCount: 1,
      jobId: JOB_ID,
      jobStatus: "RETRY_WAIT",
      jobVersion: 3,
    });
    const repository = createQrGenerationDispatcherRpcRepository(target);

    await expect(
      repository.recordDeliveryFailure({
        availableAt: "2026-07-19T06:05:00.000Z",
        errorCode: "QUEUE_UNAVAILABLE",
        expectedVersion: 2,
        jobId: JOB_ID,
      }),
    ).resolves.toMatchObject({
      batchStatus: "GENERATION_APPROVED",
      jobStatus: "RETRY_WAIT",
    });
    expect(target.rpc).toHaveBeenCalledWith("record_qr_generation_delivery_failure", {
      p_available_at: "2026-07-19T06:05:00.000Z",
      p_error_code: "QUEUE_UNAVAILABLE",
      p_expected_version: 2,
      p_job_id: JOB_ID,
    });
  });

  it.each([
    [{ code: "40001", message: "VERSION_CONFLICT" }, "CONFLICT"],
    [{ code: "55P03", message: "canceling statement due to lock timeout" }, "CONFLICT"],
    [{ code: "42501", message: "SERVER_ROLE_REQUIRED" }, "FORBIDDEN"],
    [{ code: "22023", message: "INVALID_LIMIT" }, "VALIDATION"],
    [{ code: "P0001", message: "provider payload omitted" }, "UNAVAILABLE"],
  ])("maps RPC error %s to a safe repository error", async (error, code) => {
    const target: QrGenerationDispatcherRpcClient = {
      rpc: vi.fn().mockResolvedValue({ data: null, error }),
    };
    const repository = createQrGenerationDispatcherRpcRepository(target);

    await expect(repository.claimPending({ leaseSeconds: 30, limit: 1 })).rejects.toMatchObject({
      code,
      name: "QrGenerationDispatcherRpcRepositoryError",
    });
  });

  it.each([
    null,
    { jobs: null },
    { jobs: [{ ...CLAIM, jobStatus: "PENDING_DELIVERY" }] },
    { jobs: [{ ...CLAIM, tenantId: "not-a-uuid" }] },
    { jobs: [{ ...CLAIM, deliveryAttemptCount: 0 }] },
  ])("rejects malformed claim response %s", async (data) => {
    const repository = createQrGenerationDispatcherRpcRepository(client(data));

    await expect(repository.claimPending({ leaseSeconds: 30, limit: 1 })).rejects.toEqual(
      new QrGenerationDispatcherRpcRepositoryError("UNAVAILABLE"),
    );
  });

  it("rejects a mutation response that does not match the requested transition", async () => {
    const repository = createQrGenerationDispatcherRpcRepository(
      client({
        batchId: BATCH_ID,
        batchStatus: "GENERATION_APPROVED",
        batchVersion: 3,
        deliveryAttemptCount: 1,
        jobId: JOB_ID,
        jobStatus: "RETRY_WAIT",
        jobVersion: 3,
      }),
    );

    await expect(
      repository.recordPublished({
        expectedVersion: 2,
        jobId: JOB_ID,
        queueMessageId: "pgmq:qr-generation.42",
      }),
    ).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
  });
});
