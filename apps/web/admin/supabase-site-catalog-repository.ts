import "server-only";

import type {
  OrganizationStatus,
  SiteCatalogItem,
  SiteCatalogRepository,
  SiteCatalogSort,
  SiteCatalogSortDirection,
  SiteType,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

const logger = createLogger({ service: "taptolk-web" });

function isStatus(value: unknown): value is OrganizationStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "CLOSED";
}

function isSiteType(value: unknown): value is SiteType {
  return (
    value === "APARTMENT" || value === "OFFICETEL" || value === "BUILDING" || value === "OTHER"
  );
}

function readRelation(value: unknown): Record<string, unknown> | null {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") {
    return null;
  }
  return relation as Record<string, unknown>;
}

function readRelationName(value: unknown): string | null {
  const relation = readRelation(value);
  const name = relation?.name;
  return typeof name === "string" ? name : null;
}

function canUseLegacyCatalogRead(error: { code?: string } | null) {
  return error?.code === "42703" && process.env.TAPTOLK_ALLOW_LEGACY_SITE_CATALOG === "true";
}

function escapeIlike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function mapSiteRow(row: unknown): SiteCatalogItem {
  if (!row || typeof row !== "object") {
    throw new Error("Site catalog returned an invalid row.");
  }
  const candidate = row as Record<string, unknown>;
  const managementCompany = readRelation(candidate.management_companies);
  const managementCompanyName = readRelationName(managementCompany);
  const tenantName = readRelationName(managementCompany?.tenants);
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    typeof candidate.management_company_id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.timezone !== "string" ||
    typeof candidate.contract_vehicle_limit !== "number" ||
    typeof candidate.version !== "number" ||
    typeof candidate.created_at !== "string" ||
    (candidate.address !== null && typeof candidate.address !== "string") ||
    !isSiteType(candidate.site_type) ||
    !isStatus(candidate.status) ||
    !managementCompanyName ||
    !tenantName
  ) {
    throw new Error("Site catalog returned an invalid row shape.");
  }
  return {
    address: candidate.address,
    contractVehicleLimit: candidate.contract_vehicle_limit,
    createdAt: candidate.created_at,
    id: candidate.id,
    managementCompanyId: candidate.management_company_id,
    managementCompanyName,
    name: candidate.name,
    status: candidate.status,
    tenantId: candidate.tenant_id,
    tenantName,
    timezone: candidate.timezone,
    type: candidate.site_type,
    version: candidate.version,
  };
}

export function createSupabaseSiteCatalogRepository(
  client: AdminServerClient,
): SiteCatalogRepository {
  return {
    async list({ direction, limit, managementCompanyId, offset, search, siteType, sort, status }) {
      let query = client
        .from("sites")
        .select(
          "id, tenant_id, management_company_id, name, site_type, address, timezone, contract_vehicle_limit, status, version, created_at, management_companies!inner(name, tenants!inner(name))",
          { count: "exact" },
        )
        .eq("is_test_fixture", false)
        .eq("management_companies.is_test_fixture", false)
        .eq("management_companies.tenants.is_test_fixture", false)
        .is("deleted_at", null);
      if (managementCompanyId) {
        query = query.eq("management_company_id", managementCompanyId);
      }
      if (siteType) {
        query = query.eq("site_type", siteType);
      }
      if (status) {
        query = query.eq("status", status);
      }
      if (search) {
        const escaped = escapeIlike(search);
        query = query.or(`name.ilike.%${escaped}%,address.ilike.%${escaped}%`);
      }
      if (sort === ("name" satisfies SiteCatalogSort)) {
        query = query.order("name", {
          ascending: direction === ("asc" satisfies SiteCatalogSortDirection),
        });
      } else if (sort === ("contractLimit" satisfies SiteCatalogSort)) {
        query = query.order("contract_vehicle_limit", {
          ascending: direction === ("asc" satisfies SiteCatalogSortDirection),
        });
      } else {
        query = query.order("created_at", {
          ascending: direction === ("asc" satisfies SiteCatalogSortDirection),
        });
      }
      query = query.order("id", { ascending: true }).range(offset, offset + limit - 1);
      let result = await query;
      if (canUseLegacyCatalogRead(result.error)) {
        logger.warn("admin.site_catalog.legacy_read_fallback", { scope: "sites" });
        let legacyQuery = client
          .from("sites")
          .select(
            "id, tenant_id, management_company_id, name, site_type, address, timezone, contract_vehicle_limit, status, version, created_at, management_companies!inner(name, tenants!inner(name))",
            { count: "exact" },
          )
          .is("deleted_at", null);
        if (managementCompanyId) {
          legacyQuery = legacyQuery.eq("management_company_id", managementCompanyId);
        }
        if (siteType) {
          legacyQuery = legacyQuery.eq("site_type", siteType);
        }
        if (status) {
          legacyQuery = legacyQuery.eq("status", status);
        }
        if (search) {
          const escaped = escapeIlike(search);
          legacyQuery = legacyQuery.or(`name.ilike.%${escaped}%,address.ilike.%${escaped}%`);
        }
        if (sort === ("name" satisfies SiteCatalogSort)) {
          legacyQuery = legacyQuery.order("name", {
            ascending: direction === ("asc" satisfies SiteCatalogSortDirection),
          });
        } else if (sort === ("contractLimit" satisfies SiteCatalogSort)) {
          legacyQuery = legacyQuery.order("contract_vehicle_limit", {
            ascending: direction === ("asc" satisfies SiteCatalogSortDirection),
          });
        } else {
          legacyQuery = legacyQuery.order("created_at", {
            ascending: direction === ("asc" satisfies SiteCatalogSortDirection),
          });
        }
        result = (await legacyQuery
          .order("id", { ascending: true })
          .range(offset, offset + limit - 1)) as typeof result;
      }
      if (result.error) {
        logger.error("admin.site_catalog.query_failed", { errorCode: result.error.code });
        throw new Error("Unable to load the Site catalog.");
      }
      return {
        items: (result.data ?? []).map(mapSiteRow),
        total: result.count ?? 0,
      };
    },
    async listActiveParents() {
      const query = client
        .from("management_companies")
        .select(
          "id, tenant_id, name, is_test_fixture, tenants!inner(name, status, deleted_at, is_test_fixture)",
        )
        .eq("status", "ACTIVE")
        .eq("is_test_fixture", false)
        .eq("tenants.is_test_fixture", false)
        .is("deleted_at", null)
        .eq("tenants.status", "ACTIVE")
        .is("tenants.deleted_at", null)
        .order("name", { ascending: true })
        .order("id", { ascending: true });
      let result = await query;
      if (canUseLegacyCatalogRead(result.error)) {
        logger.warn("admin.site_catalog.legacy_read_fallback", { scope: "parents" });
        result = (await client
          .from("management_companies")
          .select("id, tenant_id, name, tenants!inner(name, status, deleted_at)")
          .eq("status", "ACTIVE")
          .is("deleted_at", null)
          .eq("tenants.status", "ACTIVE")
          .is("tenants.deleted_at", null)
          .order("name", { ascending: true })
          .order("id", { ascending: true })) as typeof result;
      }
      if (result.error) {
        logger.error("admin.site_catalog.parent_options_failed", {
          errorCode: result.error.code,
        });
        throw new Error("Unable to load active Site parents.");
      }
      return (result.data ?? []).map((company) => {
        const tenantName = readRelationName(company.tenants);
        if (!tenantName) {
          throw new Error("Site parent catalog returned an invalid Tenant relation.");
        }
        return {
          managementCompanyId: company.id,
          managementCompanyName: company.name,
          tenantId: company.tenant_id,
          tenantName,
        };
      });
    },
  };
}
