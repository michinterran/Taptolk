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

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isFixtureCompanyRow(row: Record<string, unknown>): boolean {
  return row.is_test_fixture === true || /^Taptolk E2E\b/iu.test(nullableString(row.name) ?? "");
}

export function createSupabaseManagementCompanyWorkspaceRepository(
  client: AdminServerClient,
): ManagementCompanyWorkspaceRepository {
  return {
    async read(companyId) {
      const runCompanyQuery = async () => {
        const query = client
          .from("management_companies")
          .select(
            "id, tenant_id, name, management_code, address, business_number, representative_phone_encrypted, contact_name, contact_phone_encrypted, contact_email, operations_manager_name, operations_manager_phone_encrypted, operations_manager_email, status, version, is_test_fixture, tenants!inner(name)",
          )
          .eq("id", companyId)
          .eq("is_test_fixture", false)
          .is("deleted_at", null);
        return query.maybeSingle();
      };

      const companyResult = await runCompanyQuery();
      if (companyResult.error?.code === "42703") {
        logger.error("admin.management_company_workspace.company_schema_unavailable", {
          errorCode: companyResult.error.code,
        });
        throw new Error("MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE");
      }
      if (companyResult.error) {
        logger.error("admin.management_company_workspace.company_failed", {
          errorCode: companyResult.error.code,
        });
        throw new Error("MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE");
      }
      const company = companyResult.data as unknown as
        | (Record<string, unknown> & {
            id: string;
            name: string;
            status: OrganizationStatus;
            tenant_id: string;
          })
        | null;
      if (!company) return null;
      if (isFixtureCompanyRow(company)) return null;
      const tenantName = relationName(company.tenants);
      if (!tenantName || !isStatus(company.status) || typeof company.version !== "number")
        throw new Error("MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE");

      const runSiteQuery = () => {
        const query = client
          .from("sites")
          .select(
            "id, name, management_code, address, site_type, status, contract_vehicle_limit, is_test_fixture",
          )
          .eq("management_company_id", companyId)
          .eq("is_test_fixture", false)
          .is("deleted_at", null);
        return query.order("name");
      };
      const runQrQuery = () =>
        client.from("qr_assets").select("site_id, status").eq("management_company_id", companyId);
      const runBatchQuery = () =>
        client.from("qr_batches").select("site_id").eq("management_company_id", companyId);
      const runContractQuery = () =>
        client
          .from("contracts")
          .select("id")
          .eq("management_company_id", companyId)
          .eq("status", "ACTIVE")
          .is("deleted_at", null);
      const runAdminQuery = () =>
        client
          .from("admin_memberships")
          .select("id")
          .eq("management_company_id", companyId)
          .eq("status", "ACTIVE");
      const [siteResult, qrResult, batchResult, contractResult, adminResult] = await Promise.all([
        runSiteQuery(),
        runQrQuery(),
        runBatchQuery(),
        runContractQuery(),
        runAdminQuery(),
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

      const siteRows = (siteResult.data ?? []) as unknown as Array<Record<string, unknown>>;
      const sites = siteRows.map((site) => {
        if (!isStatus(site.status) || !isSiteType(site.site_type))
          throw new Error("MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE");
        const siteId = nullableString(site.id);
        const siteName = nullableString(site.name);
        if (!siteId || !siteName || typeof site.contract_vehicle_limit !== "number") {
          throw new Error("MANAGEMENT_COMPANY_WORKSPACE_UNAVAILABLE");
        }
        const qr = qrBySite.get(siteId) ?? { active: 0, total: 0 };
        return {
          address: nullableString(site.address),
          activeQrCount: qr.active,
          batchCount: batchesBySite.get(siteId) ?? 0,
          contractVehicleLimit: site.contract_vehicle_limit,
          id: siteId,
          managementCode: nullableString(site.management_code),
          name: siteName,
          status: site.status,
          totalQrCount: qr.total,
          type: site.site_type,
        };
      });
      return {
        activeContractCount: contractResult.data?.length ?? 0,
        activeQrCount: sites.reduce((sum, site) => sum + site.activeQrCount, 0),
        address: nullableString(company.address),
        adminCount: adminResult.data?.length ?? 0,
        businessNumber: nullableString(company.business_number),
        contactEmail: nullableString(company.contact_email),
        contactName: nullableString(company.contact_name),
        contactPhoneRegistered: nullableString(company.contact_phone_encrypted) !== null,
        contractVehicleLimit: sites.reduce((sum, site) => sum + site.contractVehicleLimit, 0),
        id: company.id,
        managementCode: nullableString(company.management_code),
        name: company.name,
        operationsManagerEmail: nullableString(company.operations_manager_email),
        operationsManagerName: nullableString(company.operations_manager_name),
        operationsManagerPhoneRegistered:
          nullableString(company.operations_manager_phone_encrypted) !== null,
        representativePhoneRegistered:
          nullableString(company.representative_phone_encrypted) !== null,
        sites,
        status: company.status,
        tenantId: company.tenant_id,
        tenantName,
        totalQrCount: sites.reduce((sum, site) => sum + site.totalQrCount, 0),
        version: company.version,
      } satisfies ManagementCompanyWorkspace;
    },
  };
}
