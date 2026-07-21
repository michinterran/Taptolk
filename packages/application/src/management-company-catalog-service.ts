import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { AdminAuthorizationError, assertAdminAuthorized } from "./authorization-error.js";

export const MANAGEMENT_COMPANY_PAGE_SIZE = 20;
export type OrganizationStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export interface ManagementCompanyCatalogItem {
  activeQrCount: number;
  businessNumber: string | null;
  contractVehicleLimit: number;
  createdAt: string;
  id: string;
  name: string;
  siteCount: number;
  status: OrganizationStatus;
  tenantId: string;
  tenantName: string;
  version: number;
}

export interface ManagementCompanyTenantOption {
  id: string;
  name: string;
}

export interface ManagementCompanyCatalogPage {
  items: readonly ManagementCompanyCatalogItem[];
  page: number;
  pageSize: number;
  tenantOptions: readonly ManagementCompanyTenantOption[];
  total: number;
}

export interface ManagementCompanyCatalogRepository {
  list(input: {
    limit: number;
    offset: number;
    search?: string;
  }): Promise<{ items: readonly ManagementCompanyCatalogItem[]; total: number }>;
  listActiveTenants(): Promise<readonly ManagementCompanyTenantOption[]>;
}

export class ManagementCompanyCatalogService {
  constructor(private readonly repository: ManagementCompanyCatalogRepository) {}

  async list(input: {
    actor: AdminAuthorizationContext;
    page?: number;
    search?: string;
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
        limit: MANAGEMENT_COMPANY_PAGE_SIZE,
        offset: (page - 1) * MANAGEMENT_COMPANY_PAGE_SIZE,
        ...(input.search?.trim() ? { search: input.search.trim().slice(0, 100) } : {}),
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
