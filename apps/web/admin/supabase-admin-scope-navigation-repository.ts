import "server-only";

import type {
  AdminScopeNavigationCompany,
  AdminScopeNavigationRepository,
  AdminScopeNavigationSite,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

const logger = createLogger({ service: "taptolk-web" });

function relationName(value: unknown): string | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation &&
    typeof relation === "object" &&
    typeof (relation as { name?: unknown }).name === "string"
    ? (relation as { name: string }).name
    : null;
}

function mapCompany(row: unknown): AdminScopeNavigationCompany {
  if (!row || typeof row !== "object") {
    throw new Error("ADMIN_SCOPE_NAVIGATION_UNAVAILABLE");
  }

  const candidate = row as Record<string, unknown>;
  const tenantName = relationName(candidate.tenants);

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    !tenantName
  ) {
    throw new Error("ADMIN_SCOPE_NAVIGATION_UNAVAILABLE");
  }

  return {
    id: candidate.id,
    name: candidate.name,
    tenantId: candidate.tenant_id,
    tenantName,
  };
}

function mapSite(row: unknown): AdminScopeNavigationSite {
  if (!row || typeof row !== "object") {
    throw new Error("ADMIN_SCOPE_NAVIGATION_UNAVAILABLE");
  }

  const candidate = row as Record<string, unknown>;
  const managementCompanyName = relationName(candidate.management_companies);

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    typeof candidate.management_company_id !== "string" ||
    !managementCompanyName
  ) {
    throw new Error("ADMIN_SCOPE_NAVIGATION_UNAVAILABLE");
  }

  return {
    id: candidate.id,
    managementCompanyId: candidate.management_company_id,
    managementCompanyName,
    name: candidate.name,
    tenantId: candidate.tenant_id,
  };
}

export function createSupabaseAdminScopeNavigationRepository(
  client: AdminServerClient,
): AdminScopeNavigationRepository {
  return {
    async list({ limit }) {
      const [companyResult, siteResult] = await Promise.all([
        client
          .from("management_companies")
          .select("id, tenant_id, name, tenants!inner(name)")
          .is("deleted_at", null)
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .limit(limit),
        client
          .from("sites")
          .select("id, tenant_id, management_company_id, name, management_companies!inner(name)")
          .is("deleted_at", null)
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .limit(limit),
      ]);

      if (companyResult.error || siteResult.error) {
        logger.error("admin.scope_navigation.query_failed", {
          errorCode: companyResult.error?.code ?? siteResult.error?.code,
        });
        throw new Error("ADMIN_SCOPE_NAVIGATION_UNAVAILABLE");
      }

      return {
        managementCompanies: (companyResult.data ?? []).map(mapCompany),
        sites: (siteResult.data ?? []).map(mapSite),
      };
    },
  };
}
