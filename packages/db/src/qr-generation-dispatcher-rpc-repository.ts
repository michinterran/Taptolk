import type {
  QrGenerationDeliveryClaim,
  QrGenerationDeliveryMutationResult,
  QrGenerationDispatcherRepository,
} from "@taptolk/application";

type QrGenerationDispatcherRpcFunction =
  | "claim_pending_qr_generation_jobs"
  | "record_qr_generation_delivery_failure"
  | "record_qr_generation_job_published";

interface QrGenerationDispatcherRpcError {
  code?: string;
  message?: string;
}

interface QrGenerationDispatcherRpcResult {
  data: unknown;
  error: QrGenerationDispatcherRpcError | null;
}

export interface QrGenerationDispatcherRpcClient {
  rpc(
    functionName: QrGenerationDispatcherRpcFunction,
    parameters: Readonly<Record<string, unknown>>,
  ): Promise<QrGenerationDispatcherRpcResult>;
}

export class QrGenerationDispatcherRpcRepositoryError extends Error {
  readonly code: "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE" | "VALIDATION";

  constructor(code: QrGenerationDispatcherRpcRepositoryError["code"]) {
    super(`QR generation dispatcher RPC repository failed: ${code}`);
    this.name = "QrGenerationDispatcherRpcRepositoryError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function mapRpcError(
  error: QrGenerationDispatcherRpcError,
): QrGenerationDispatcherRpcRepositoryError {
  const message = error.message ?? "";
  if (
    error.code === "40001" ||
    error.code === "55P03" ||
    message.includes("VERSION_CONFLICT") ||
    message.includes("DELIVERY_LEASE_REQUIRED") ||
    message.includes("BATCH_NOT_GENERATION_APPROVED") ||
    message.includes("lock timeout")
  ) {
    return new QrGenerationDispatcherRpcRepositoryError("CONFLICT");
  }
  if (error.code === "42501" || message.includes("SERVER_ROLE_REQUIRED")) {
    return new QrGenerationDispatcherRpcRepositoryError("FORBIDDEN");
  }
  if (error.code === "22023" || message.startsWith("INVALID_")) {
    return new QrGenerationDispatcherRpcRepositoryError("VALIDATION");
  }
  return new QrGenerationDispatcherRpcRepositoryError("UNAVAILABLE");
}

function parseClaim(value: unknown): QrGenerationDeliveryClaim {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrGenerationDispatcherRpcRepositoryError("UNAVAILABLE");
  }
  const claim = value as Record<string, unknown>;
  if (
    !isUuid(claim.batchId) ||
    !isIsoDate(claim.createdAt) ||
    !isPositiveInteger(claim.deliveryAttemptCount) ||
    !isPositiveInteger(claim.generationRevision) ||
    !isUuid(claim.jobId) ||
    claim.jobStatus !== "DELIVERY_LEASED" ||
    claim.jobType !== "QR_GENERATION" ||
    !isPositiveInteger(claim.jobVersion) ||
    !isIsoDate(claim.leaseExpiresAt) ||
    !isUuid(claim.siteId) ||
    !isUuid(claim.tenantId)
  ) {
    throw new QrGenerationDispatcherRpcRepositoryError("UNAVAILABLE");
  }
  return {
    batchId: claim.batchId,
    createdAt: claim.createdAt,
    deliveryAttemptCount: claim.deliveryAttemptCount,
    generationRevision: claim.generationRevision,
    jobId: claim.jobId,
    jobStatus: claim.jobStatus,
    jobType: claim.jobType,
    jobVersion: claim.jobVersion,
    leaseExpiresAt: claim.leaseExpiresAt,
    siteId: claim.siteId,
    tenantId: claim.tenantId,
  };
}

function parseClaims(value: unknown): readonly QrGenerationDeliveryClaim[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrGenerationDispatcherRpcRepositoryError("UNAVAILABLE");
  }
  const jobs = (value as Record<string, unknown>).jobs;
  if (!Array.isArray(jobs)) {
    throw new QrGenerationDispatcherRpcRepositoryError("UNAVAILABLE");
  }
  return jobs.map(parseClaim);
}

function parseMutation(
  value: unknown,
  expected: {
    batchStatus: QrGenerationDeliveryMutationResult["batchStatus"];
    jobStatus: "QUEUED" | "RETRY_WAIT";
  },
): QrGenerationDeliveryMutationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrGenerationDispatcherRpcRepositoryError("UNAVAILABLE");
  }
  const result = value as Record<string, unknown>;
  if (
    !isUuid(result.batchId) ||
    result.batchStatus !== expected.batchStatus ||
    !isPositiveInteger(result.batchVersion) ||
    !isPositiveInteger(result.deliveryAttemptCount) ||
    !isUuid(result.jobId) ||
    result.jobStatus !== expected.jobStatus ||
    !isPositiveInteger(result.jobVersion)
  ) {
    throw new QrGenerationDispatcherRpcRepositoryError("UNAVAILABLE");
  }
  return {
    batchId: result.batchId,
    batchStatus: expected.batchStatus,
    batchVersion: result.batchVersion,
    deliveryAttemptCount: result.deliveryAttemptCount,
    jobId: result.jobId,
    jobStatus: expected.jobStatus,
    jobVersion: result.jobVersion,
  };
}

async function execute<T>(
  operation: Promise<QrGenerationDispatcherRpcResult>,
  parse: (value: unknown) => T,
): Promise<T> {
  const result = await operation;
  if (result.error) {
    throw mapRpcError(result.error);
  }
  return parse(result.data);
}

export function createQrGenerationDispatcherRpcRepository(
  client: QrGenerationDispatcherRpcClient,
): QrGenerationDispatcherRepository {
  return {
    claimPending(input) {
      return execute(
        client.rpc("claim_pending_qr_generation_jobs", {
          p_lease_seconds: input.leaseSeconds,
          p_limit: input.limit,
        }),
        parseClaims,
      );
    },
    recordDeliveryFailure(input) {
      return execute(
        client.rpc("record_qr_generation_delivery_failure", {
          p_available_at: input.availableAt,
          p_error_code: input.errorCode,
          p_expected_version: input.expectedVersion,
          p_job_id: input.jobId,
        }),
        (value) =>
          parseMutation(value, {
            batchStatus: "GENERATION_APPROVED",
            jobStatus: "RETRY_WAIT",
          }),
      );
    },
    recordPublished(input) {
      return execute(
        client.rpc("record_qr_generation_job_published", {
          p_expected_version: input.expectedVersion,
          p_job_id: input.jobId,
          p_queue_message_id: input.queueMessageId,
        }),
        (value) =>
          parseMutation(value, {
            batchStatus: "GENERATION_QUEUED",
            jobStatus: "QUEUED",
          }),
      );
    },
  };
}
