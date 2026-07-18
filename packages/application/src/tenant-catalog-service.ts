import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { AdminAuthorizationError, assertAdminAuthorized } from "./authorization-error.js";

export const TENANT_CATALOG_PAGE_SIZE = 20;
export const TENANT_CATALOG_MAX_PAGE_SIZE = 50;

export type TenantStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export interface TenantCatalogItem {
  createdAt: string;
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  version: number;
}

export interface TenantCatalogPage {
  items: readonly TenantCatalogItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TenantCatalogRepository {
  list(input: {
    limit: number;
    offset: number;
  }): Promise<{ items: readonly TenantCatalogItem[]; total: number }>;
}

export interface ListTenantCatalogCommand {
  actor: AdminAuthorizationContext;
  page?: number;
  pageSize?: number;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? (value as number) : fallback;
}

export class TenantCatalogService {
  constructor(private readonly repository: TenantCatalogRepository) {}

  async list(command: ListTenantCatalogCommand): Promise<TenantCatalogPage> {
    if (command.actor.scope.type !== "PLATFORM") {
      throw new AdminAuthorizationError("OUT_OF_SCOPE");
    }

    assertAdminAuthorized(
      authorizeAdminAction(command.actor, "tenant:read", {
        tenantId: "platform-catalog",
      }),
    );

    const page = normalizePositiveInteger(command.page, 1);
    const requestedPageSize = normalizePositiveInteger(command.pageSize, TENANT_CATALOG_PAGE_SIZE);
    const pageSize = Math.min(requestedPageSize, TENANT_CATALOG_MAX_PAGE_SIZE);
    const result = await this.repository.list({
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      items: result.items,
      page,
      pageSize,
      total: result.total,
    };
  }
}
