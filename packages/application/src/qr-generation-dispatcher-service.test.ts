import { describe, expect, it, vi } from "vitest";
import {
  QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS,
  QR_GENERATION_DISPATCH_CLAIM_LIMIT_MAX,
  QR_GENERATION_DISPATCH_LEASE_SECONDS_MAX,
  QR_GENERATION_DISPATCH_LEASE_SECONDS_MIN,
  QrGenerationDispatcherError,
  type QrGenerationDispatcherRepository,
  QrGenerationDispatcherService,
} from "./qr-generation-dispatcher-service.js";

const JOB_ID = "00000000-0000-4000-8000-000000000101";
const NOW = new Date("2026-07-19T06:00:00.000Z");

function repository(): QrGenerationDispatcherRepository {
  return {
    claimPending: vi.fn().mockResolvedValue([]),
    recordDeliveryFailure: vi.fn().mockResolvedValue({
      batchId: "00000000-0000-4000-8000-000000000201",
      batchStatus: "GENERATION_APPROVED",
      batchVersion: 4,
      deliveryAttemptCount: 2,
      jobId: JOB_ID,
      jobStatus: "RETRY_WAIT",
      jobVersion: 3,
    }),
    recordPublished: vi.fn().mockResolvedValue({
      batchId: "00000000-0000-4000-8000-000000000201",
      batchStatus: "GENERATION_QUEUED",
      batchVersion: 4,
      deliveryAttemptCount: 1,
      jobId: JOB_ID,
      jobStatus: "QUEUED",
      jobVersion: 3,
    }),
  };
}

describe("QrGenerationDispatcherService", () => {
  it("claims only within the bounded dispatcher policy", async () => {
    const target = repository();
    const service = new QrGenerationDispatcherService(target);

    await expect(
      service.claimPending({
        leaseSeconds: QR_GENERATION_DISPATCH_LEASE_SECONDS_MIN,
        limit: QR_GENERATION_DISPATCH_CLAIM_LIMIT_MAX,
      }),
    ).resolves.toEqual([]);
    expect(target.claimPending).toHaveBeenCalledWith({
      leaseSeconds: QR_GENERATION_DISPATCH_LEASE_SECONDS_MIN,
      limit: QR_GENERATION_DISPATCH_CLAIM_LIMIT_MAX,
    });
  });

  it.each([
    { leaseSeconds: 30, limit: 0, message: "INVALID_LIMIT" },
    {
      leaseSeconds: 30,
      limit: QR_GENERATION_DISPATCH_CLAIM_LIMIT_MAX + 1,
      message: "INVALID_LIMIT",
    },
    {
      leaseSeconds: QR_GENERATION_DISPATCH_LEASE_SECONDS_MIN - 1,
      limit: 1,
      message: "INVALID_LEASE_SECONDS",
    },
    {
      leaseSeconds: QR_GENERATION_DISPATCH_LEASE_SECONDS_MAX + 1,
      limit: 1,
      message: "INVALID_LEASE_SECONDS",
    },
  ])("rejects invalid claim input: $message", async ({ leaseSeconds, limit, message }) => {
    const service = new QrGenerationDispatcherService(repository());

    await expect(service.claimPending({ leaseSeconds, limit })).rejects.toMatchObject({
      code: message,
    });
  });

  it("normalizes a provider message identity before publication acknowledgement", async () => {
    const target = repository();
    const service = new QrGenerationDispatcherService(target);

    await service.recordPublished({
      expectedVersion: 2,
      jobId: JOB_ID,
      queueMessageId: "  pgmq:qr-generation.42  ",
    });

    expect(target.recordPublished).toHaveBeenCalledWith({
      expectedVersion: 2,
      jobId: JOB_ID,
      queueMessageId: "pgmq:qr-generation.42",
    });
  });

  it.each([
    {
      expectedVersion: 1,
      jobId: "not-a-uuid",
      message: "INVALID_ID",
      queueMessageId: "message-1",
    },
    {
      expectedVersion: 0,
      jobId: JOB_ID,
      message: "INVALID_VERSION",
      queueMessageId: "message-1",
    },
    {
      expectedVersion: 1,
      jobId: JOB_ID,
      message: "INVALID_QUEUE_MESSAGE_ID",
      queueMessageId: "contains space",
    },
  ])("rejects invalid publication input: $message", async (input) => {
    const service = new QrGenerationDispatcherService(repository());

    await expect(service.recordPublished(input)).rejects.toMatchObject({
      code: input.message,
    });
  });

  it("normalizes a bounded future retry and allowlisted error code", async () => {
    const target = repository();
    const service = new QrGenerationDispatcherService(target, () => NOW);

    await service.recordDeliveryFailure({
      availableAt: "2026-07-19T06:05:00Z",
      errorCode: "  QUEUE_UNAVAILABLE  ",
      expectedVersion: 2,
      jobId: JOB_ID,
    });

    expect(target.recordDeliveryFailure).toHaveBeenCalledWith({
      availableAt: "2026-07-19T06:05:00.000Z",
      errorCode: "QUEUE_UNAVAILABLE",
      expectedVersion: 2,
      jobId: JOB_ID,
    });
  });

  it.each([
    {
      availableAt: "invalid",
      errorCode: "QUEUE_UNAVAILABLE",
      message: "INVALID_AVAILABLE_AT",
    },
    {
      availableAt: NOW.toISOString(),
      errorCode: "QUEUE_UNAVAILABLE",
      message: "INVALID_AVAILABLE_AT",
    },
    {
      availableAt: new Date(
        NOW.getTime() + QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS + 1,
      ).toISOString(),
      errorCode: "QUEUE_UNAVAILABLE",
      message: "INVALID_AVAILABLE_AT",
    },
    {
      availableAt: "2026-07-19T06:05:00Z",
      errorCode: "raw provider failure",
      message: "INVALID_ERROR_CODE",
    },
  ])("rejects invalid delivery failure input: $message", async (input) => {
    const service = new QrGenerationDispatcherService(repository(), () => NOW);

    await expect(
      service.recordDeliveryFailure({
        ...input,
        expectedVersion: 2,
        jobId: JOB_ID,
      }),
    ).rejects.toMatchObject({ code: input.message });
  });

  it("exposes typed dispatcher errors without provider payloads", () => {
    expect(new QrGenerationDispatcherError("INVALID_ERROR_CODE")).toMatchObject({
      code: "INVALID_ERROR_CODE",
      name: "QrGenerationDispatcherError",
    });
  });
});
