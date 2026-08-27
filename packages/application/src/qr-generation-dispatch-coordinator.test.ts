import { describe, expect, it, vi } from "vitest";
import {
  buildQrGenerationQueueMessage,
  type QrGenerationDeliveryRetryPolicy,
  type QrGenerationDispatchCommands,
  QrGenerationDispatchCoordinator,
  type QrGenerationQueuePublisher,
  QrGenerationQueuePublisherError,
} from "./qr-generation-dispatch-coordinator.js";
import type { QrGenerationDeliveryClaim } from "./qr-generation-dispatcher-service.js";

const CLAIM: QrGenerationDeliveryClaim = {
  batchId: "00000000-0000-4000-8000-000000000201",
  createdAt: "2026-07-19T06:00:00.000Z",
  deliveryAttemptCount: 1,
  generationRevision: 1,
  jobId: "00000000-0000-4000-8000-000000000101",
  jobStatus: "DELIVERY_LEASED",
  jobType: "QR_GENERATION",
  jobVersion: 2,
  leaseExpiresAt: "2026-07-19T06:00:30.000Z",
  siteId: "00000000-0000-4000-8000-000000000301",
  tenantId: "00000000-0000-4000-8000-000000000401",
};

function commands(claims: readonly QrGenerationDeliveryClaim[] = [CLAIM]) {
  return {
    claimPending: vi.fn().mockResolvedValue(claims),
    recordDeliveryFailure: vi.fn().mockResolvedValue({
      batchId: CLAIM.batchId,
      batchStatus: "GENERATION_APPROVED",
      batchVersion: 4,
      deliveryAttemptCount: CLAIM.deliveryAttemptCount,
      jobId: CLAIM.jobId,
      jobStatus: "RETRY_WAIT",
      jobVersion: CLAIM.jobVersion + 1,
    }),
    recordPublished: vi.fn().mockResolvedValue({
      batchId: CLAIM.batchId,
      batchStatus: "GENERATION_QUEUED",
      batchVersion: 4,
      deliveryAttemptCount: CLAIM.deliveryAttemptCount,
      jobId: CLAIM.jobId,
      jobStatus: "QUEUED",
      jobVersion: CLAIM.jobVersion + 1,
    }),
  } satisfies QrGenerationDispatchCommands;
}

function publisher() {
  return {
    publish: vi.fn().mockResolvedValue({
      queueMessageId: "pgmq:qr-generation.42",
    }),
  } satisfies QrGenerationQueuePublisher;
}

function retryPolicy() {
  return {
    nextAvailableAt: vi.fn().mockReturnValue("2026-07-19T06:05:00.000Z"),
  } satisfies QrGenerationDeliveryRetryPolicy;
}

describe("QrGenerationDispatchCoordinator", () => {
  it("builds the strict stable Queue message from one delivery claim", () => {
    expect(buildQrGenerationQueueMessage(CLAIM)).toEqual({
      batchId: CLAIM.batchId,
      createdAt: CLAIM.createdAt,
      deliveryAttempt: 1,
      generationRevision: 1,
      jobId: CLAIM.jobId,
      jobType: "QR_GENERATION",
      schemaVersion: 1,
      siteId: CLAIM.siteId,
      tenantId: CLAIM.tenantId,
      traceId: CLAIM.jobId,
    });
  });

  it("records successful publication with the active lease version", async () => {
    const target = commands();
    const queue = publisher();
    const coordinator = new QrGenerationDispatchCoordinator(target, queue, retryPolicy());

    await expect(coordinator.runOnce({ leaseSeconds: 30, limit: 10 })).resolves.toEqual({
      claimedCount: 1,
      outcomes: [{ jobId: CLAIM.jobId, status: "PUBLISHED" }],
    });
    expect(target.claimPending).toHaveBeenCalledWith({ leaseSeconds: 30, limit: 10 });
    expect(queue.publish).toHaveBeenCalledWith(buildQrGenerationQueueMessage(CLAIM));
    expect(target.recordPublished).toHaveBeenCalledWith({
      expectedVersion: CLAIM.jobVersion,
      jobId: CLAIM.jobId,
      queueMessageId: "pgmq:qr-generation.42",
    });
    expect(target.recordDeliveryFailure).not.toHaveBeenCalled();
  });

  it("records an allowlisted retry after a typed provider failure", async () => {
    const target = commands();
    const queue = publisher();
    const policy = retryPolicy();
    queue.publish.mockRejectedValue(new QrGenerationQueuePublisherError("QUEUE_RATE_LIMITED"));
    const coordinator = new QrGenerationDispatchCoordinator(target, queue, policy);

    await expect(coordinator.runOnce({ leaseSeconds: 30, limit: 1 })).resolves.toEqual({
      claimedCount: 1,
      outcomes: [{ jobId: CLAIM.jobId, status: "DELIVERY_RETRY_SCHEDULED" }],
    });
    expect(policy.nextAvailableAt).toHaveBeenCalledWith({
      claim: CLAIM,
      errorCode: "QUEUE_RATE_LIMITED",
    });
    expect(target.recordDeliveryFailure).toHaveBeenCalledWith({
      availableAt: "2026-07-19T06:05:00.000Z",
      errorCode: "QUEUE_RATE_LIMITED",
      expectedVersion: CLAIM.jobVersion,
      jobId: CLAIM.jobId,
    });
    expect(target.recordPublished).not.toHaveBeenCalled();
  });

  it("reduces an unknown provider error to QUEUE_UNAVAILABLE", async () => {
    const target = commands();
    const queue = publisher();
    queue.publish.mockRejectedValue(new Error("raw provider response must not cross the boundary"));
    const coordinator = new QrGenerationDispatchCoordinator(target, queue, retryPolicy());

    await coordinator.runOnce({ leaseSeconds: 30, limit: 1 });

    expect(target.recordDeliveryFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "QUEUE_UNAVAILABLE",
      }),
    );
  });

  it("leaves the lease recoverable when publication succeeds but acknowledgement fails", async () => {
    const target = commands();
    const queue = publisher();
    target.recordPublished.mockRejectedValue(new Error("database unavailable"));
    const coordinator = new QrGenerationDispatchCoordinator(target, queue, retryPolicy());

    await expect(coordinator.runOnce({ leaseSeconds: 30, limit: 1 })).resolves.toEqual({
      claimedCount: 1,
      outcomes: [
        {
          jobId: CLAIM.jobId,
          status: "PUBLICATION_ACKNOWLEDGEMENT_PENDING",
        },
      ],
    });
    expect(queue.publish).toHaveBeenCalledTimes(1);
    expect(target.recordDeliveryFailure).not.toHaveBeenCalled();
  });

  it("leaves the lease recoverable when delivery failure acknowledgement also fails", async () => {
    const target = commands();
    const queue = publisher();
    queue.publish.mockRejectedValue(new QrGenerationQueuePublisherError("QUEUE_UNAVAILABLE"));
    target.recordDeliveryFailure.mockRejectedValue(new Error("database unavailable"));
    const coordinator = new QrGenerationDispatchCoordinator(target, queue, retryPolicy());

    await expect(coordinator.runOnce({ leaseSeconds: 30, limit: 1 })).resolves.toEqual({
      claimedCount: 1,
      outcomes: [
        {
          jobId: CLAIM.jobId,
          status: "DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING",
        },
      ],
    });
    expect(target.recordPublished).not.toHaveBeenCalled();
  });

  it("returns an empty bounded result when no delivery intent is claimable", async () => {
    const target = commands([]);
    const queue = publisher();
    const coordinator = new QrGenerationDispatchCoordinator(target, queue, retryPolicy());

    await expect(coordinator.runOnce({ leaseSeconds: 30, limit: 10 })).resolves.toEqual({
      claimedCount: 0,
      outcomes: [],
    });
    expect(queue.publish).not.toHaveBeenCalled();
  });
});
