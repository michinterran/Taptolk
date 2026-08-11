import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { AdminAuthorizationError, assertAdminAuthorized } from "./authorization-error.js";

export const QR_DIRECT_GENERATION_QUANTITY_MIN = 1;
export const QR_DIRECT_GENERATION_QUANTITY_MAX = 10_000;

export interface QrDirectGenerationActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface QrDirectGenerationBatchResult {
  batchCode: string;
  batchId: string;
  batchStatus: string;
  batchVersion: number;
  generationRevision: number;
  jobId: string;
  jobStatus: string;
  requestedQuantity: number;
}

export interface QrDirectGenerationResult {
  batches: readonly QrDirectGenerationBatchResult[];
  requestId: string;
  siteId: string;
  totalQuantity: number;
}

export interface QrDirectGenerationRepository {
  request(input: {
    expectedSiteVersion: number;
    idempotencyKey: string;
    quantity: number;
    reason: string;
    siteId: string;
  }): Promise<QrDirectGenerationResult>;
}

export class QrDirectGenerationError extends Error {
  readonly code: "INVALID_ID" | "INVALID_QUANTITY" | "INVALID_REASON" | "INVALID_VERSION";

  constructor(code: QrDirectGenerationError["code"]) {
    super(`QR direct generation rejected: ${code}`);
    this.name = "QrDirectGenerationError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/iu;

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new QrDirectGenerationError("INVALID_ID");
  }
}

function normalizeReason(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 500) {
    throw new QrDirectGenerationError("INVALID_REASON");
  }
  return normalized;
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new QrDirectGenerationError("INVALID_VERSION");
  }
}

function assertQuantity(value: number): void {
  if (
    !Number.isInteger(value) ||
    value < QR_DIRECT_GENERATION_QUANTITY_MIN ||
    value > QR_DIRECT_GENERATION_QUANTITY_MAX
  ) {
    throw new QrDirectGenerationError("INVALID_QUANTITY");
  }
}

function assertAdminOnly(actor: QrDirectGenerationActor, siteId: string): void {
  assertUuid(actor.userId);
  if (
    actor.authorization.role !== "SUPER_ADMIN" &&
    actor.authorization.role !== "PLATFORM_OPERATOR"
  ) {
    throw new AdminAuthorizationError("ROLE_FORBIDDEN");
  }
  assertAdminAuthorized(
    authorizeAdminAction(actor.authorization, "qr-batch:request", {
      managementCompanyId: actor.authorization.scope.managementCompanyId ?? "platform-direct",
      siteId,
      tenantId: actor.authorization.scope.tenantId ?? "platform-direct",
    }),
  );
}

export class QrDirectGenerationService {
  constructor(private readonly repository: QrDirectGenerationRepository) {}

  async request(input: {
    actor: QrDirectGenerationActor;
    expectedSiteVersion: number;
    idempotencyKey: string;
    quantity: number;
    reason: string;
    siteId: string;
  }): Promise<QrDirectGenerationResult> {
    assertUuid(input.siteId);
    assertUuid(input.idempotencyKey);
    assertVersion(input.expectedSiteVersion);
    assertQuantity(input.quantity);
    assertAdminOnly(input.actor, input.siteId);
    return this.repository.request({
      expectedSiteVersion: input.expectedSiteVersion,
      idempotencyKey: input.idempotencyKey,
      quantity: input.quantity,
      reason: normalizeReason(input.reason),
      siteId: input.siteId,
    });
  }
}
