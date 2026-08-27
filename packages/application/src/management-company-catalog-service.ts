import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { AdminAuthorizationError, assertAdminAuthorized } from "./authorization-error.js";

export const MANAGEMENT_COMPANY_PAGE_SIZE = 10;
export type OrganizationStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export interface ManagementCompanyCatalogItem {
  address: string | null;
  activeQrCount: number;
  businessNumber: string | null;
  capacityUsagePercent: number;
  contractEndsAt: string | null;
  contractPlan: string | null;
  contractStatus: "ACTIVE" | "DRAFT" | "EXPIRED" | "SUSPENDED" | "TERMINATED" | null;
  contractVehicleLimit: number;
  createdAt: string;
  id: string;
  /** Taptolk operates this company's sites directly rather than a customer's company. */
  isPlatformDirect: boolean;
  name: string;
  managementCode: string | null;
  qrActivationPercent: number;
  responseQuality: "GOOD" | "LOW" | "NONE" | "NORMAL";
  riskLevel: "GOOD" | "NORMAL" | "RISK" | "WATCH";
  siteCount: number;
  status: OrganizationStatus;
  tenantId: string;
  tenantName: string;
  totalQrCount: number;
  unresolvedContactCount: number;
  version: number;
}

export interface ManagementCompanyTenantOption {
  id: string;
  name: string;
}

export interface ManagementCompanyCatalogPage {
  activeContractCount: number;
  expiringContractCount: number;
  expiredContractCount: number;
  items: readonly ManagementCompanyCatalogItem[];
  lowRiskCount: number;
  page: number;
  pageSize: number;
  siteTotal: number;
  tenantOptions: readonly ManagementCompanyTenantOption[];
  total: number;
}

export interface ManagementCompanyCatalogRepository {
  list(input: {
    limit: number;
    offset: number;
    includeTestFixtures?: boolean;
    search?: string;
    status?: OrganizationStatus;
  }): Promise<{
    activeContractCount: number;
    expiringContractCount: number;
    expiredContractCount: number;
    items: readonly ManagementCompanyCatalogItem[];
    lowRiskCount: number;
    siteTotal: number;
    total: number;
  }>;
  listActiveTenants(): Promise<readonly ManagementCompanyTenantOption[]>;
}

export class ManagementCompanyCatalogService {
  constructor(private readonly repository: ManagementCompanyCatalogRepository) {}

  async list(input: {
    actor: AdminAuthorizationContext;
    page?: number;
    search?: string;
    status?: OrganizationStatus;
  }): Promise<ManagementCompanyCatalogPage> {
    if (input.actor.scope.type !== "PLATFORM") {
      throw new AdminAuthorizationError("OUT_OF_SCOPE");
    }
    assertAdminAuthorized(
      authorizeAdminAction(input.actor, "management-company:read", {
        tenantId: "platform-management-company-catalog",
      }),
    );
    const page = Number.isInteger(input.page) && (input.page ?? 0) > 0 ? (input.page as number) : 1;
    const [catalog, tenantOptions] = await Promise.all([
      this.repository.list({
        includeTestFixtures: false,
        limit: MANAGEMENT_COMPANY_PAGE_SIZE,
        offset: (page - 1) * MANAGEMENT_COMPANY_PAGE_SIZE,
        ...(input.search?.trim() ? { search: input.search.trim().slice(0, 100) } : {}),
        ...(input.status ? { status: input.status } : {}),
      }),
      this.repository.listActiveTenants(),
    ]);
    return {
      ...catalog,
      page,
      pageSize: MANAGEMENT_COMPANY_PAGE_SIZE,
      tenantOptions,
    };
  }
}
