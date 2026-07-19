import "server-only";

import type {
  ManagementCompanyCatalogItem,
  ManagementCompanyCatalogRepository,
  OrganizationStatus,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

const logger = createLogger({ service: "taptolk-web" });

function isStatus(value: unknown): value is OrganizationStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "CLOSED";
}

function readTenantName(value: unknown): string | null {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") {
    return null;
  }
  const name = (relation as { name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

function mapCompanyRow(row: unknown): ManagementCompanyCatalogItem {
  if (!row || typeof row !== "object") {
    throw new Error("Management Company catalog returned an invalid row.");
  }
  const candidate = row as Record<string, unknown>;
  const tenantName = readTenantName(candidate.tenants);
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.created_at !== "string" ||
    typeof candidate.version !== "number" ||
    !isStatus(candidate.status) ||
    !tenantName ||
    (candidate.business_number !== null && typeof candidate.business_number !== "string")
  ) {
    throw new Error("Management Company catalog returned an invalid row shape.");
  }
  return {
    businessNumber: candidate.business_number,
    createdAt: candidate.created_at,
    id: candidate.id,
    name: candidate.name,
    status: candidate.status,
    tenantId: candidate.tenant_id,
    tenantName,
    version: candidate.version,
  };
}

export function createSupabaseManagementCompanyCatalogRepository(
  client: AdminServerClient,
): ManagementCompanyCatalogRepository {
  return {
    async list({ limit, offset }) {
      const result = await client
        .from("management_companies")
        .select(
          "id, tenant_id, name, business_number, status, version, created_at, tenants!inner(name)",
          { count: "exact" },
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1);
      if (result.error) {
        logger.error("admin.management_company_catalog.query_failed", {
          errorCode: result.error.code,
        });
        throw new Error("Unable to load the Management Company catalog.");
      }
      return {
        items: (result.data ?? []).map(mapCompanyRow),
        total: result.count ?? 0,
      };
    },
    async listActiveTenants() {
      const result = await client
        .from("tenants")
        .select("id, name")
        .eq("status", "ACTIVE")
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .order("id", { ascending: true });
      if (result.error) {
        logger.error("admin.management_company_catalog.tenant_options_failed", {
          errorCode: result.error.code,
        });
        throw new Error("Unable to load active Tenant options.");
      }
      return (result.data ?? []).map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
      }));
    },
  };
}
