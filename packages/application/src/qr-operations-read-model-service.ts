import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";
import type { QrBatchStatus } from "./qr-inventory-sample-service.js";
import type { SiteType } from "./site-service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface QrOperationsActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface QrOperationsCompany {
  address: string | null;
  contractVehicleLimit: number;
  id: string;
  managementCode: string | null;
  name: string;
  siteCount: number;
  status: OrganizationStatus;
  tenantId: string;
  totalQr: number;
  activeQr: number;
}

export interface QrOperationsSite {
  activeQr: number;
  address: string | null;
  batchCount: number;
  contractVehicleLimit: number;
  generatedQr: number;
  id: string;
  managementCode: string | null;
  managementCompanyId: string;
  name: string;
  pendingActivationQr: number;
  status: OrganizationStatus;
  tenantId: string;
  totalQr: number;
  type: SiteType;
  version: number;
}

export interface QrOperationsBatch {
  batchCode: string;
  createdAt: string;
  directGenerationRequestId: string | null;
  downloadReady: boolean;
  executionAttemptCount: number | null;
  exportTypes: readonly ("CSV" | "MANIFEST" | "PDF" | "ZIP")[];
  failedQuantity: number;
  generatedQuantity: number;
  id: string;
  jobFailedQuantity: number;
  jobPassedQuantity: number;
  jobStatus: string | null;
  managementCompanyId: string;
  passedQuantity: number;
  processedCount: number | null;
  renderedQuantity: number;
  requestedQuantity: number;
  siteId: string;
  siteName: string;
  status: QrBatchStatus;
  version: number;
}

export interface QrOperationsTotals {
  activeQr: number;
  completedBatches: number;
  generatedQr: number;
  pendingActivationQr: number;
  siteCount: number;
  totalBatches: number;
  totalCompanies: number;
  totalQr: number;
}

export interface QrOperationsReadModel {
  batches: readonly QrOperationsBatch[];
  companies: readonly QrOperationsCompany[];
  sites: readonly QrOperationsSite[];
  totals: QrOperationsTotals;
}

export interface QrOperationsReadModelRepository {
  read(): Promise<QrOperationsReadModel>;
}

export class QrOperationsReadModelService {
  constructor(private readonly repository: QrOperationsReadModelRepository) {}

  async read(input: { actor: QrOperationsActor }): Promise<QrOperationsReadModel> {
    if (!UUID_PATTERN.test(input.actor.userId)) {
      throw new Error("INVALID_ID");
    }
    const scope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "qr-batch:read", {
        ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
        ...(scope.siteId ? { siteId: scope.siteId } : {}),
        tenantId: scope.tenantId ?? "platform-qr-operations",
      }),
    );
    return this.repository.read();
  }
}
