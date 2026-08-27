import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";
import type { SiteType } from "./site-service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ManagementCompanyWorkspaceSite {
  activeQrCount: number;
  address: string | null;
  batchCount: number;
  contractVehicleLimit: number;
  id: string;
  managementCode: string | null;
  name: string;
  status: OrganizationStatus;
  totalQrCount: number;
  type: SiteType;
}

export interface ManagementCompanyWorkspace {
  activeContractCount: number;
  activeQrCount: number;
  address: string | null;
  adminCount: number;
  businessNumber: string | null;
  contactEmail: string | null;
  contactName: string | null;
  contactPhoneRegistered: boolean;
  contractVehicleLimit: number;
  id: string;
  managementCode: string | null;
  name: string;
  operationsManagerEmail: string | null;
  operationsManagerName: string | null;
  operationsManagerPhoneRegistered: boolean;
  representativePhoneRegistered: boolean;
  sites: readonly ManagementCompanyWorkspaceSite[];
  status: OrganizationStatus;
  tenantId: string;
  tenantName: string;
  totalQrCount: number;
  version: number;
}

export interface ManagementCompanyWorkspaceRepository {
  read(companyId: string): Promise<ManagementCompanyWorkspace | null>;
}

export class ManagementCompanyWorkspaceService {
  constructor(private readonly repository: ManagementCompanyWorkspaceRepository) {}

  async read(input: {
    actor: AdminAuthorizationContext;
    companyId: string;
  }): Promise<ManagementCompanyWorkspace | null> {
    if (!UUID_PATTERN.test(input.companyId)) throw new Error("INVALID_ID");
    const scope = input.actor.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor, "management-company:read", {
        managementCompanyId: input.companyId,
        tenantId: scope.tenantId ?? "platform-management-company-workspace",
      }),
    );
    return this.repository.read(input.companyId);
  }
}
