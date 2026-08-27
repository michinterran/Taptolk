import type { AdminAuthorizationContext } from "@taptolk/domain";
import { authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { QrBatchStatus } from "./qr-inventory-sample-service.js";

export const QR_ONLY_GENERATION_QUANTITY_MIN = 1;
export const QR_ONLY_GENERATION_QUANTITY_MAX = 10_000;

export interface QrOnlyGenerationActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface QrOnlyGenerationBatchResult {
  batchCode: string;
  batchId: string;
  batchStatus: QrBatchStatus;
  batchVersion: number;
  generationRevision: number;
  jobId: string;
  jobStatus: string;
  requestedQuantity: number;
}

export interface QrOnlyGenerationResult {
  batches: readonly QrOnlyGenerationBatchResult[];
  requestId: string;
  siteId: string;
  totalQuantity: number;
}

export interface QrOnlyGenerationRepository {
  request(input: {
    expectedSiteVersion: number;
    idempotencyKey: string;
    quantity: number;
    reason: string;
    siteId: string;
  }): Promise<QrOnlyGenerationResult>;
}

export class QrOnlyGenerationError extends Error {
  readonly code:
    | "FORBIDDEN"
    | "INVALID_ID"
    | "INVALID_QUANTITY"
    | "INVALID_REASON"
    | "INVALID_VERSION";

  constructor(code: QrOnlyGenerationError["code"]) {
    super(`QR-only generation rejected: ${code}`);
    this.name = "QrOnlyGenerationError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new QrOnlyGenerationError("INVALID_ID");
}

export class QrOnlyGenerationService {
  constructor(readonly repository: QrOnlyGenerationRepository) {}

  async request(input: {
    actor: QrOnlyGenerationActor;
    expectedSiteVersion: number;
    idempotencyKey: string;
    quantity: number;
    reason: string;
    siteId: string;
  }): Promise<QrOnlyGenerationResult> {
    assertUuid(input.actor.userId);
    if (input.actor.authorization.role !== "SUPER_ADMIN") {
      throw new QrOnlyGenerationError("FORBIDDEN");
    }
    assertUuid(input.siteId);
    assertUuid(input.idempotencyKey);
    if (!Number.isInteger(input.expectedSiteVersion) || input.expectedSiteVersion < 1) {
      throw new QrOnlyGenerationError("INVALID_VERSION");
    }
    if (
      !Number.isInteger(input.quantity) ||
      input.quantity < QR_ONLY_GENERATION_QUANTITY_MIN ||
      input.quantity > QR_ONLY_GENERATION_QUANTITY_MAX
    ) {
      throw new QrOnlyGenerationError("INVALID_QUANTITY");
    }
    if (input.reason.trim().length < 3 || input.reason.trim().length > 500) {
      throw new QrOnlyGenerationError("INVALID_REASON");
    }
    const scope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "qr-batch:request", {
        ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
        ...(scope.siteId ? { siteId: scope.siteId } : {}),
        tenantId: scope.tenantId ?? "platform-qr-only-generation",
      }),
    );
    return this.repository.request({
      expectedSiteVersion: input.expectedSiteVersion,
      idempotencyKey: input.idempotencyKey,
      quantity: input.quantity,
      reason: input.reason.trim(),
      siteId: input.siteId,
    });
  }
}
