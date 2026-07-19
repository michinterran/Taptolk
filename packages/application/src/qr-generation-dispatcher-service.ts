import type { QrGenerationJobStatus } from "./qr-final-generation-approval-service.js";

export const QR_GENERATION_DISPATCH_CLAIM_LIMIT_MAX = 50;
export const QR_GENERATION_DISPATCH_LEASE_SECONDS_MIN = 5;
export const QR_GENERATION_DISPATCH_LEASE_SECONDS_MAX = 300;
export const QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS = 24 * 60 * 60 * 1_000;

export interface QrGenerationDeliveryClaim {
  batchId: string;
  createdAt: string;
  deliveryAttemptCount: number;
  generationRevision: number;
  jobId: string;
  jobStatus: "DELIVERY_LEASED";
  jobType: "QR_GENERATION";
  jobVersion: number;
  leaseExpiresAt: string;
  siteId: string;
  tenantId: string;
}

export interface QrGenerationDeliveryMutationResult {
  batchId: string;
  batchStatus: "GENERATION_APPROVED" | "GENERATION_QUEUED";
  batchVersion: number;
  deliveryAttemptCount: number;
  jobId: string;
  jobStatus: QrGenerationJobStatus;
  jobVersion: number;
}

export interface QrGenerationDispatcherRepository {
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

export class QrGenerationDispatcherError extends Error {
  readonly code:
    | "INVALID_AVAILABLE_AT"
    | "INVALID_ERROR_CODE"
    | "INVALID_ID"
    | "INVALID_LEASE_SECONDS"
    | "INVALID_LIMIT"
    | "INVALID_QUEUE_MESSAGE_ID"
    | "INVALID_VERSION";

  constructor(code: QrGenerationDispatcherError["code"]) {
    super(`QR generation dispatcher rejected: ${code}`);
    this.name = "QrGenerationDispatcherError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const QUEUE_MESSAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const ERROR_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_]{1,63}$/u;

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new QrGenerationDispatcherError("INVALID_ID");
  }
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new QrGenerationDispatcherError("INVALID_VERSION");
  }
}

function assertClaimInput(input: { leaseSeconds: number; limit: number }): void {
  if (
    !Number.isInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > QR_GENERATION_DISPATCH_CLAIM_LIMIT_MAX
  ) {
    throw new QrGenerationDispatcherError("INVALID_LIMIT");
  }
  if (
    !Number.isInteger(input.leaseSeconds) ||
    input.leaseSeconds < QR_GENERATION_DISPATCH_LEASE_SECONDS_MIN ||
    input.leaseSeconds > QR_GENERATION_DISPATCH_LEASE_SECONDS_MAX
  ) {
    throw new QrGenerationDispatcherError("INVALID_LEASE_SECONDS");
  }
}

function normalizeQueueMessageId(value: string): string {
  const normalized = value.trim();
  if (!QUEUE_MESSAGE_ID_PATTERN.test(normalized)) {
    throw new QrGenerationDispatcherError("INVALID_QUEUE_MESSAGE_ID");
  }
  return normalized;
}

function normalizeErrorCode(value: string): string {
  const normalized = value.trim();
  if (!ERROR_CODE_PATTERN.test(normalized)) {
    throw new QrGenerationDispatcherError("INVALID_ERROR_CODE");
  }
  return normalized;
}

function normalizeAvailableAt(value: string, now: Date): string {
  const candidate = new Date(value);
  const timestamp = candidate.getTime();
  const currentTimestamp = now.getTime();
  if (
    !Number.isFinite(timestamp) ||
    timestamp <= currentTimestamp ||
    timestamp > currentTimestamp + QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS
  ) {
    throw new QrGenerationDispatcherError("INVALID_AVAILABLE_AT");
  }
  return candidate.toISOString();
}

export class QrGenerationDispatcherService {
  constructor(
    private readonly repository: QrGenerationDispatcherRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async claimPending(input: {
    leaseSeconds: number;
    limit: number;
  }): Promise<readonly QrGenerationDeliveryClaim[]> {
    assertClaimInput(input);
    return this.repository.claimPending(input);
  }

  async recordPublished(input: {
    expectedVersion: number;
    jobId: string;
    queueMessageId: string;
  }): Promise<QrGenerationDeliveryMutationResult> {
    assertUuid(input.jobId);
    assertVersion(input.expectedVersion);
    return this.repository.recordPublished({
      expectedVersion: input.expectedVersion,
      jobId: input.jobId,
      queueMessageId: normalizeQueueMessageId(input.queueMessageId),
    });
  }

  async recordDeliveryFailure(input: {
    availableAt: string;
    errorCode: string;
    expectedVersion: number;
    jobId: string;
  }): Promise<QrGenerationDeliveryMutationResult> {
    assertUuid(input.jobId);
    assertVersion(input.expectedVersion);
    return this.repository.recordDeliveryFailure({
      availableAt: normalizeAvailableAt(input.availableAt, this.now()),
      errorCode: normalizeErrorCode(input.errorCode),
      expectedVersion: input.expectedVersion,
      jobId: input.jobId,
    });
  }
}
