import type { AdminAuthorizationContext } from "@taptolk/domain";

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
  readonly code:
    | "APPROVAL_REQUIRED"
    | "INVALID_ID"
    | "INVALID_QUANTITY"
    | "INVALID_REASON"
    | "INVALID_VERSION";

  constructor(code: QrDirectGenerationError["code"]) {
    super(`QR direct generation rejected: ${code}`);
    this.name = "QrDirectGenerationError";
    this.code = code;
  }
}

export class QrDirectGenerationService {
  constructor(readonly repository: QrDirectGenerationRepository) {}

  async request(input: {
    actor: QrDirectGenerationActor;
    expectedSiteVersion: number;
    idempotencyKey: string;
    quantity: number;
    reason: string;
    siteId: string;
  }): Promise<QrDirectGenerationResult> {
    void input;
    throw new QrDirectGenerationError("APPROVAL_REQUIRED");
  }
}
