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

function mapCompanyRow(
  row: unknown,
  metrics: ReadonlyMap<
    string,
    { activeQrCount: number; contractVehicleLimit: number; siteCount: number }
  >,
): ManagementCompanyCatalogItem {
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
    activeQrCount: metrics.get(candidate.id)?.activeQrCount ?? 0,
    businessNumber: candidate.business_number,
    contractVehicleLimit: metrics.get(candidate.id)?.contractVehicleLimit ?? 0,
    createdAt: candidate.created_at,
    id: candidate.id,
    isPlatformDirect: candidate.is_platform_direct === true,
    name: candidate.name,
    siteCount: metrics.get(candidate.id)?.siteCount ?? 0,
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
    async list({ limit, offset, search, status }) {
      let query = client
        .from("management_companies")
        .select(
          "id, tenant_id, name, business_number, status, version, created_at, is_platform_direct, tenants!inner(name)",
          { count: "exact" },
        )
        .is("deleted_at", null);
      if (search) {
        query = query.ilike("name", `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
      }
      if (status) {
        query = query.eq("status", status);
      }
      const result = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1);
      if (result.error) {
        logger.error("admin.management_company_catalog.query_failed", {
          errorCode: result.error.code,
        });
        throw new Error("Unable to load the Management Company catalog.");
      }
      const rows = result.data ?? [];
      const companyIds = rows.map((row) => row.id);
      const metrics = new Map<
        string,
        { activeQrCount: number; contractVehicleLimit: number; siteCount: number }
      >();
      if (companyIds.length > 0) {
        const [siteResult, qrResult] = await Promise.all([
          client
            .from("sites")
            .select("id, management_company_id, contract_vehicle_limit")
            .in("management_company_id", companyIds)
            .is("deleted_at", null),
          client
            .from("qr_assets")
            .select("management_company_id")
            .in("management_company_id", companyIds)
            .eq("status", "ACTIVE"),
        ]);
        if (siteResult.error || qrResult.error) {
          logger.error("admin.management_company_catalog.metrics_failed", {
            errorCode: siteResult.error?.code ?? qrResult.error?.code,
          });
          throw new Error("Unable to load Management Company metrics.");
        }
        for (const companyId of companyIds) {
          metrics.set(companyId, { activeQrCount: 0, contractVehicleLimit: 0, siteCount: 0 });
        }
        for (const site of siteResult.data ?? []) {
          const current = metrics.get(site.management_company_id);
          if (current) {
            current.siteCount += 1;
            current.contractVehicleLimit += site.contract_vehicle_limit;
          }
        }
        for (const asset of qrResult.data ?? []) {
          const current = metrics.get(asset.management_company_id);
          if (current) {
            current.activeQrCount += 1;
          }
        }
      }
      return {
        items: rows.map((row) => mapCompanyRow(row, metrics)),
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
