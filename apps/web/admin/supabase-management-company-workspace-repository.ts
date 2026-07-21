import "server-only";

import type {
  ManagementCompanyWorkspace,
  ManagementCompanyWorkspaceRepository,
  OrganizationStatus,
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

function relationName(value: unknown): string | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation &&
    typeof relation === "object" &&
    typeof (relation as { name?: unknown }).name === "string"
    ? (relation as { name: string }).name
    : null;
}

export function createSupabaseManagementCompanyWorkspaceRepository(
  client: AdminServerClient,
): ManagementCompanyWorkspaceRepository {
  return {
    async read(companyId) {
      const companyResult = await client
        .from("management_companies")
        .select("id, tenant_id, name, business_number, status, tenants!inner(name)")
        .eq("id", companyId)
        .is("deleted_at", null)
        .maybeSingle();
      if (companyResult.error) {
        logger.error("admin.management_company_workspace.company_failed", {
          errorCode: companyResult.error.code,
        });
        throw new Error("MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE");
      }
      const company = companyResult.data;
      if (!company) return null;
      const tenantName = relationName(company.tenants);
      if (!tenantName || !isStatus(company.status))
        throw new Error("MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE");

      const [siteResult, qrResult, batchResult, contractResult, adminResult] = await Promise.all([
        client
          .from("sites")
          .select("id, name, site_type, status, contract_vehicle_limit")
          .eq("management_company_id", companyId)
          .is("deleted_at", null)
          .order("name"),
        client.from("qr_assets").select("site_id, status").eq("management_company_id", companyId),
        client.from("qr_batches").select("site_id").eq("management_company_id", companyId),
        client
          .from("contracts")
          .select("id")
          .eq("management_company_id", companyId)
          .eq("status", "ACTIVE")
          .is("deleted_at", null),
        client
          .from("admin_memberships")
          .select("id")
          .eq("management_company_id", companyId)
          .eq("status", "ACTIVE"),
      ]);
      const failed = [
        siteResult.error,
        qrResult.error,
        batchResult.error,
        contractResult.error,
        adminResult.error,
      ].find(Boolean);
      if (failed) {
        logger.error("admin.management_company_workspace.metrics_failed", {
          errorCode: failed?.code,
        });
        throw new Error("MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE");
      }

      const qrBySite = new Map<string, { active: number; total: number }>();
      for (const asset of qrResult.data ?? []) {
        const current = qrBySite.get(asset.site_id) ?? { active: 0, total: 0 };
        current.total += 1;
        if (asset.status === "ACTIVE") current.active += 1;
        qrBySite.set(asset.site_id, current);
      }
      const batchesBySite = new Map<string, number>();
      for (const batch of batchResult.data ?? [])
        batchesBySite.set(batch.site_id, (batchesBySite.get(batch.site_id) ?? 0) + 1);

      const sites = (siteResult.data ?? []).map((site) => {
        if (!isStatus(site.status) || !isSiteType(site.site_type))
          throw new Error("MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE");
        const qr = qrBySite.get(site.id) ?? { active: 0, total: 0 };
        return {
          activeQrCount: qr.active,
          batchCount: batchesBySite.get(site.id) ?? 0,
          contractVehicleLimit: site.contract_vehicle_limit,
          id: site.id,
          name: site.name,
          status: site.status,
          totalQrCount: qr.total,
          type: site.site_type,
        };
      });
      return {
        activeContractCount: contractResult.data?.length ?? 0,
        activeQrCount: sites.reduce((sum, site) => sum + site.activeQrCount, 0),
        adminCount: adminResult.data?.length ?? 0,
        businessNumber: company.business_number,
        contractVehicleLimit: sites.reduce((sum, site) => sum + site.contractVehicleLimit, 0),
        id: company.id,
        name: company.name,
        sites,
        status: company.status,
        tenantId: company.tenant_id,
        tenantName,
        totalQrCount: sites.reduce((sum, site) => sum + site.totalQrCount, 0),
      } satisfies ManagementCompanyWorkspace;
    },
  };
}
