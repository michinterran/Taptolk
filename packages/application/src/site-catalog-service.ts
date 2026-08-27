import {
  type AdminAuthorizationContext,
  authorizeAdminAction,
  roleHasPermission,
} from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";
import type { SiteType } from "./site-service.js";

export const SITE_CATALOG_PAGE_SIZE = 20;
export const SITE_CATALOG_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type SiteCatalogPageSize = (typeof SITE_CATALOG_PAGE_SIZE_OPTIONS)[number];
export type SiteCatalogSort = "contractLimit" | "createdAt" | "name";
export type SiteCatalogSortDirection = "asc" | "desc";

export interface SiteCatalogQuery {
  direction?: SiteCatalogSortDirection;
  managementCompanyId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  siteType?: SiteType;
  sort?: SiteCatalogSort;
  status?: OrganizationStatus;
}

export interface SiteCatalogQueryState {
  direction: SiteCatalogSortDirection;
  managementCompanyId?: string;
  pageSize: SiteCatalogPageSize;
  search?: string;
  siteType?: SiteType;
  sort: SiteCatalogSort;
  status?: OrganizationStatus;
}

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
  query: SiteCatalogQueryState;
  total: number;
}

export interface SiteCatalogRepository {
  list(input: {
    direction: SiteCatalogSortDirection;
    limit: number;
    managementCompanyId?: string;
    offset: number;
    search?: string;
    siteType?: SiteType;
    sort: SiteCatalogSort;
    status?: OrganizationStatus;
  }): Promise<{ items: readonly SiteCatalogItem[]; total: number }>;
  listActiveParents(): Promise<readonly SiteParentOption[]>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function normalizeSearch(value: string | undefined): string | undefined {
  const candidate = value?.trim().slice(0, 100);
  return candidate || undefined;
}

function normalizePageSize(value: number | undefined): SiteCatalogPageSize {
  return SITE_CATALOG_PAGE_SIZE_OPTIONS.includes(value as SiteCatalogPageSize)
    ? (value as SiteCatalogPageSize)
    : SITE_CATALOG_PAGE_SIZE;
}

function normalizeSort(value: SiteCatalogSort | undefined): SiteCatalogSort {
  return value === "name" || value === "contractLimit" || value === "createdAt"
    ? value
    : "createdAt";
}

function normalizeDirection(value: SiteCatalogSortDirection | undefined): SiteCatalogSortDirection {
  return value === "asc" || value === "desc" ? value : "desc";
}

function isSiteType(value: SiteType | undefined): value is SiteType {
  return (
    value === "APARTMENT" || value === "OFFICETEL" || value === "BUILDING" || value === "OTHER"
  );
}

function isOrganizationStatus(value: OrganizationStatus | undefined): value is OrganizationStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "CLOSED";
}

export class SiteCatalogService {
  constructor(private readonly repository: SiteCatalogRepository) {}

  async list(input: {
    actor: AdminAuthorizationContext;
    query?: SiteCatalogQuery;
  }): Promise<SiteCatalogPage> {
    const resource = {
      ...(input.actor.scope.managementCompanyId
        ? { managementCompanyId: input.actor.scope.managementCompanyId }
        : {}),
      ...(input.actor.scope.siteId ? { siteId: input.actor.scope.siteId } : {}),
      tenantId: input.actor.scope.tenantId ?? "platform-site-catalog",
    };
    assertAdminAuthorized(authorizeAdminAction(input.actor, "site:read", resource));
    const requestedQuery = input.query ?? {};
    const page =
      Number.isInteger(requestedQuery.page) && (requestedQuery.page ?? 0) > 0
        ? (requestedQuery.page as number)
        : 1;
    const pageSize = normalizePageSize(requestedQuery.pageSize);
    const sort = normalizeSort(requestedQuery.sort);
    const direction = normalizeDirection(requestedQuery.direction);
    const managementCompanyId = requestedQuery.managementCompanyId?.trim();
    const search = normalizeSearch(requestedQuery.search);
    const query: SiteCatalogQueryState = {
      direction,
      ...(managementCompanyId && UUID_PATTERN.test(managementCompanyId)
        ? { managementCompanyId }
        : {}),
      pageSize,
      ...(search ? { search } : {}),
      ...(isSiteType(requestedQuery.siteType) ? { siteType: requestedQuery.siteType } : {}),
      sort,
      ...(isOrganizationStatus(requestedQuery.status) ? { status: requestedQuery.status } : {}),
    };
    const [catalog, parentOptions] = await Promise.all([
      this.repository.list({
        direction: query.direction,
        limit: query.pageSize,
        ...(query.managementCompanyId ? { managementCompanyId: query.managementCompanyId } : {}),
        offset: (page - 1) * query.pageSize,
        ...(query.search ? { search: query.search } : {}),
        ...(query.siteType ? { siteType: query.siteType } : {}),
        sort: query.sort,
        ...(query.status ? { status: query.status } : {}),
      }),
      roleHasPermission(input.actor.role, "site:read")
        ? this.repository.listActiveParents()
        : Promise.resolve([]),
    ]);
    return {
      ...catalog,
      page,
      pageSize: query.pageSize,
      parentOptions,
      query,
    };
  }
}
