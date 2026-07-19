import type {
  QrGenerationDeliveryClaim,
  QrGenerationDeliveryMutationResult,
} from "./qr-generation-dispatcher-service.js";

export const QR_GENERATION_QUEUE_SCHEMA_VERSION = 1;
export const QR_GENERATION_QUEUE_JOB_TYPE = "QR_GENERATION";

export const QR_GENERATION_QUEUE_PUBLISH_ERROR_CODES = [
  "QUEUE_RATE_LIMITED",
  "QUEUE_UNAVAILABLE",
] as const;

export type QrGenerationQueuePublishErrorCode =
  (typeof QR_GENERATION_QUEUE_PUBLISH_ERROR_CODES)[number];

export interface QrGenerationQueueMessage {
  batchId: string;
  createdAt: string;
  deliveryAttempt: number;
  generationRevision: number;
  jobId: string;
  jobType: typeof QR_GENERATION_QUEUE_JOB_TYPE;
  schemaVersion: typeof QR_GENERATION_QUEUE_SCHEMA_VERSION;
  siteId: string;
  tenantId: string;
  traceId: string;
}

export interface QrGenerationQueuePublisher {
  publish(message: QrGenerationQueueMessage): Promise<{
    queueMessageId: string;
  }>;
}

export interface QrGenerationDispatchCommands {
  claimPending(input: {
    leaseSeconds: number;
    limit: number;
  }): Promise<readonly QrGenerationDeliveryClaim[]>;
  recordDeliveryFailure(input: {
    availableAt: string;
    errorCode: string;
    expectedVersion: number;
    jobId: string;
  }): Promise<QrGenerationDeliveryMutationResult>;
  recordPublished(input: {
    expectedVersion: number;
    jobId: string;
    queueMessageId: string;
  }): Promise<QrGenerationDeliveryMutationResult>;
}

export interface QrGenerationDeliveryRetryPolicy {
  nextAvailableAt(input: {
    claim: QrGenerationDeliveryClaim;
    errorCode: QrGenerationQueuePublishErrorCode;
  }): string;
}

export type QrGenerationDispatchOutcomeStatus =
  | "DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING"
  | "DELIVERY_RETRY_SCHEDULED"
  | "PUBLICATION_ACKNOWLEDGEMENT_PENDING"
  | "PUBLISHED";

export interface QrGenerationDispatchOutcome {
  jobId: string;
  status: QrGenerationDispatchOutcomeStatus;
}

export interface QrGenerationDispatchResult {
  claimedCount: number;
  outcomes: readonly QrGenerationDispatchOutcome[];
}

export class QrGenerationQueuePublisherError extends Error {
  readonly code: QrGenerationQueuePublishErrorCode;

  constructor(code: QrGenerationQueuePublishErrorCode) {
    super(`QR generation Queue publisher failed: ${code}`);
    this.name = "QrGenerationQueuePublisherError";
    this.code = code;
  }
}

export function buildQrGenerationQueueMessage(
  claim: QrGenerationDeliveryClaim,
): QrGenerationQueueMessage {
  return {
    batchId: claim.batchId,
    createdAt: claim.createdAt,
    deliveryAttempt: claim.deliveryAttemptCount,
    generationRevision: claim.generationRevision,
    jobId: claim.jobId,
    jobType: QR_GENERATION_QUEUE_JOB_TYPE,
    schemaVersion: QR_GENERATION_QUEUE_SCHEMA_VERSION,
    siteId: claim.siteId,
    tenantId: claim.tenantId,
    traceId: claim.jobId,
  };
}

function safePublishErrorCode(error: unknown): QrGenerationQueuePublishErrorCode {
  return error instanceof QrGenerationQueuePublisherError ? error.code : "QUEUE_UNAVAILABLE";
}

export class QrGenerationDispatchCoordinator {
  constructor(
    private readonly commands: QrGenerationDispatchCommands,
    private readonly publisher: QrGenerationQueuePublisher,
    private readonly retryPolicy: QrGenerationDeliveryRetryPolicy,
  ) {}

  async runOnce(input: {
    leaseSeconds: number;
    limit: number;
  }): Promise<QrGenerationDispatchResult> {
    const claims = await this.commands.claimPending(input);
    const outcomes: QrGenerationDispatchOutcome[] = [];

    for (const claim of claims) {
      let publication: { queueMessageId: string };
      try {
        publication = await this.publisher.publish(buildQrGenerationQueueMessage(claim));
      } catch (error) {
        const errorCode = safePublishErrorCode(error);
        try {
          await this.commands.recordDeliveryFailure({
            availableAt: this.retryPolicy.nextAvailableAt({ claim, errorCode }),
            errorCode,
            expectedVersion: claim.jobVersion,
            jobId: claim.jobId,
          });
          outcomes.push({
            jobId: claim.jobId,
            status: "DELIVERY_RETRY_SCHEDULED",
          });
        } catch {
          outcomes.push({
            jobId: claim.jobId,
            status: "DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING",
          });
        }
        continue;
      }

      try {
        await this.commands.recordPublished({
          expectedVersion: claim.jobVersion,
          jobId: claim.jobId,
          queueMessageId: publication.queueMessageId,
        });
        outcomes.push({
          jobId: claim.jobId,
          status: "PUBLISHED",
        });
      } catch {
        outcomes.push({
          jobId: claim.jobId,
          status: "PUBLICATION_ACKNOWLEDGEMENT_PENDING",
        });
      }
    }

    return {
      claimedCount: claims.length,
      outcomes,
    };
  }
}
