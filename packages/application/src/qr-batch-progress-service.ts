import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { QrBatchStatus } from "./qr-inventory-sample-service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface QrBatchProgressActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface QrBatchProgressItem {
  batchCode: string;
  executionAttemptCount: number | null;
  exportTypes: readonly ("CSV" | "MANIFEST" | "PDF" | "ZIP")[];
  failedQuantity: number;
  generatedQuantity: number;
  id: string;
  jobStatus: string | null;
  passedQuantity: number;
  processedCount: number | null;
  renderedQuantity: number;
  requestedQuantity: number;
  siteName: string;
  status: QrBatchStatus;
}

export interface QrBatchProgressRepository {
  list(): Promise<readonly QrBatchProgressItem[]>;
}

export class QrBatchProgressService {
  constructor(private readonly repository: QrBatchProgressRepository) {}

  async list(input: { actor: QrBatchProgressActor }): Promise<readonly QrBatchProgressItem[]> {
    if (!UUID_PATTERN.test(input.actor.userId)) {
      throw new Error("INVALID_ID");
    }
    const scope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "qr-batch:read", {
        ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
        ...(scope.siteId ? { siteId: scope.siteId } : {}),
        tenantId: scope.tenantId ?? "platform-progress",
      }),
    );
    return this.repository.list();
  }
}
