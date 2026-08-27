import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";
import type { SiteType } from "./site-service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface SiteWorkspaceBatch {
  id: string;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  receipts: readonly SiteWorkspaceBatchReceipt[];
  status: string;
  version: number;
}

export interface SiteWorkspaceBatchReceipt {
  createdAt: string;
  quantity: number;
}

export interface SiteEscalationQueueItem {
  createdAt: string;
  escalatedAt: string;
  reasonCode: string;
  sessionId: string;
  siteAddress: string | null;
  siteContactLocation: string | null;
  status: "ESCALATED";
  vehiclePlateLast4: string;
}

export interface SiteWorkspace {
  activeQrCount: number;
  address: string | null;
  batches: readonly SiteWorkspaceBatch[];
  contactCount: number;
  contractVehicleLimit: number;
  failedNotificationCount: number;
  id: string;
  managementCompanyId: string;
  managementCompanyName: string;
  name: string;
  openContactCount: number;
  siteEscalations: readonly SiteEscalationQueueItem[];
  status: OrganizationStatus;
  tenantId: string;
  totalQrCount: number;
  type: SiteType;
  timezone: string;
  version: number;
}

export interface SiteWorkspaceRepository {
  read(siteId: string): Promise<SiteWorkspace | null>;
}

export class SiteWorkspaceService {
  constructor(private readonly repository: SiteWorkspaceRepository) {}
  async read(input: {
    actor: AdminAuthorizationContext;
    siteId: string;
  }): Promise<SiteWorkspace | null> {
    if (!UUID_PATTERN.test(input.siteId)) throw new Error("INVALID_ID");
    const scope = input.actor.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor, "site:read", {
        ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
        siteId: input.siteId,
        tenantId: scope.tenantId ?? "platform-site-workspace",
      }),
    );
    return this.repository.read(input.siteId);
  }
}
