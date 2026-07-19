import {
  type AdminAuthorizationContext,
  authorizeAdminAction,
  roleHasPermission,
} from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";
import type { SiteType } from "./site-service.js";

export const SITE_CATALOG_PAGE_SIZE = 20;

export interface SiteCatalogItem {
  address: string | null;
  contractVehicleLimit: number;
  createdAt: string;
  id: string;
  managementCompanyId: string;
  managementCompanyName: string;
  name: string;
  status: OrganizationStatus;
  tenantId: string;
  tenantName: string;
  timezone: string;
  type: SiteType;
  version: number;
}

export interface SiteParentOption {
  managementCompanyId: string;
  managementCompanyName: string;
  tenantId: string;
  tenantName: string;
}

export interface SiteCatalogPage {
  items: readonly SiteCatalogItem[];
  page: number;
  pageSize: number;
  parentOptions: readonly SiteParentOption[];
  total: number;
}

export interface SiteCatalogRepository {
  list(input: {
    limit: number;
    offset: number;
  }): Promise<{ items: readonly SiteCatalogItem[]; total: number }>;
  listActiveParents(): Promise<readonly SiteParentOption[]>;
}

export class SiteCatalogService {
  constructor(private readonly repository: SiteCatalogRepository) {}

  async list(input: { actor: AdminAuthorizationContext; page?: number }): Promise<SiteCatalogPage> {
    const resource = {
      ...(input.actor.scope.managementCompanyId
        ? { managementCompanyId: input.actor.scope.managementCompanyId }
        : {}),
      ...(input.actor.scope.siteId ? { siteId: input.actor.scope.siteId } : {}),
      tenantId: input.actor.scope.tenantId ?? "platform-site-catalog",
    };
    assertAdminAuthorized(authorizeAdminAction(input.actor, "site:read", resource));
    const page = Number.isInteger(input.page) && (input.page ?? 0) > 0 ? (input.page as number) : 1;
    const [catalog, parentOptions] = await Promise.all([
      this.repository.list({
        limit: SITE_CATALOG_PAGE_SIZE,
        offset: (page - 1) * SITE_CATALOG_PAGE_SIZE,
      }),
      roleHasPermission(input.actor.role, "site:create")
        ? this.repository.listActiveParents()
        : Promise.resolve([]),
    ]);
    return {
      ...catalog,
      page,
      pageSize: SITE_CATALOG_PAGE_SIZE,
      parentOptions,
    };
  }
}
