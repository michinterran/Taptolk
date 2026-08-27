import "server-only";

import type {
  ManagementCompanyCatalogItem,
  ManagementCompanyCatalogRepository,
  OrganizationStatus,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;
type ContractStatus = "ACTIVE" | "DRAFT" | "EXPIRED" | "SUSPENDED" | "TERMINATED";

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

function isFixtureCompanyRow(row: Record<string, unknown>): boolean {
  return row.is_test_fixture === true || /^Taptolk E2E\b/iu.test(nullableString(row.name) ?? "");
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isContractStatus(value: unknown): value is ContractStatus {
  return (
    value === "ACTIVE" ||
    value === "DRAFT" ||
    value === "EXPIRED" ||
    value === "SUSPENDED" ||
    value === "TERMINATED"
  );
}

function daysUntil(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const today = new Date();
  const currentUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const target = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(target.getTime())) {
    return null;
  }
  return Math.ceil((target.getTime() - currentUtc) / 86_400_000);
}

function mapCompanyRow(
  row: unknown,
  metrics: ReadonlyMap<
    string,
    {
      activeContractCount: number;
      activeQrCount: number;
      capacityUsagePercent: number;
      contactCount: number;
      contractEndsAt: string | null;
      contractPlan: string | null;
      contractStatus: ContractStatus | null;
      contractVehicleLimit: number;
      expiredContractCount: number;
      expiringContractCount: number;
      ownerResponseCount: number;
      qrActivationPercent: number;
      siteCount: number;
      totalQrCount: number;
      unresolvedContactCount: number;
    }
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
    !tenantName
  ) {
    throw new Error("Management Company catalog returned an invalid row shape.");
  }
  const companyMetrics = metrics.get(candidate.id);
  const capacityUsagePercent = companyMetrics?.capacityUsagePercent ?? 0;
  const qrActivationPercent = companyMetrics?.qrActivationPercent ?? 0;
  const unresolvedContactCount = companyMetrics?.unresolvedContactCount ?? 0;
  const responseQuality =
    (companyMetrics?.contactCount ?? 0) === 0
      ? "NONE"
      : unresolvedContactCount >= 10
        ? "LOW"
        : (companyMetrics?.ownerResponseCount ?? 0) / (companyMetrics?.contactCount ?? 1) >= 0.8
          ? "GOOD"
          : "NORMAL";
  const riskLevel =
    candidate.status !== "ACTIVE" || (companyMetrics?.expiredContractCount ?? 0) > 0
      ? "RISK"
      : (companyMetrics?.expiringContractCount ?? 0) > 0 ||
          capacityUsagePercent >= 90 ||
          unresolvedContactCount >= 5 ||
          responseQuality === "LOW"
        ? "WATCH"
        : "GOOD";

  return {
    address: nullableString(candidate.address),
    activeQrCount: companyMetrics?.activeQrCount ?? 0,
    businessNumber: nullableString(candidate.business_number),
    capacityUsagePercent,
    contractEndsAt: companyMetrics?.contractEndsAt ?? null,
    contractPlan: companyMetrics?.contractPlan ?? null,
    contractStatus: companyMetrics?.contractStatus ?? null,
    contractVehicleLimit: companyMetrics?.contractVehicleLimit ?? 0,
    createdAt: candidate.created_at,
    id: candidate.id,
    isPlatformDirect: candidate.is_platform_direct === true,
    managementCode: nullableString(candidate.management_code),
    name: candidate.name,
    qrActivationPercent,
    responseQuality,
    riskLevel,
    siteCount: companyMetrics?.siteCount ?? 0,
    status: candidate.status,
    tenantId: candidate.tenant_id,
    tenantName,
    totalQrCount: companyMetrics?.totalQrCount ?? 0,
    unresolvedContactCount,
    version: candidate.version,
  };
}

export function createSupabaseManagementCompanyCatalogRepository(
  client: AdminServerClient,
): ManagementCompanyCatalogRepository {
  return {
    async list({ includeTestFixtures, limit, offset, search, status }) {
      const runCatalogQuery = async (withOperationalIdentity: boolean) => {
        let query = client
          .from("management_companies")
          .select(
            withOperationalIdentity
              ? "id, tenant_id, name, management_code, address, business_number, status, version, created_at, is_platform_direct, is_test_fixture, tenants!inner(name)"
              : "id, tenant_id, name, business_number, status, version, created_at, is_platform_direct, tenants!inner(name)",
            { count: "exact" },
          )
          .is("deleted_at", null);
        if (!includeTestFixtures && withOperationalIdentity) {
          query = query.eq("is_test_fixture", false);
        }
        if (search) {
          query = query.ilike("name", `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
        }
        if (status) {
          query = query.eq("status", status);
        }
        return query
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + limit - 1);
      };

      let result = await runCatalogQuery(true);
      let hasOperationalIdentityColumns = true;
      if (result.error?.code === "42703") {
        result = await runCatalogQuery(false);
        hasOperationalIdentityColumns = false;
      }
      if (result.error) {
        logger.error("admin.management_company_catalog.query_failed", {
          errorCode: result.error.code,
        });
        throw new Error("Unable to load the Management Company catalog.");
      }
      const queriedRows = (result.data ?? []) as unknown as Array<
        Record<string, unknown> & { id: string }
      >;
      const rows = includeTestFixtures
        ? queriedRows
        : queriedRows.filter((row) => !isFixtureCompanyRow(row));
      const companyIds = rows.map((row) => row.id);
      const metrics = new Map<
        string,
        {
          activeContractCount: number;
          activeQrCount: number;
          capacityUsagePercent: number;
          contactCount: number;
          contractEndsAt: string | null;
          contractPlan: string | null;
          contractStatus: ContractStatus | null;
          contractVehicleLimit: number;
          expiredContractCount: number;
          expiringContractCount: number;
          ownerResponseCount: number;
          qrActivationPercent: number;
          siteCount: number;
          totalQrCount: number;
          unresolvedContactCount: number;
        }
      >();
      if (companyIds.length > 0) {
        const runSiteMetricsQuery = (withFixtureFilter: boolean) => {
          let query = client
            .from("sites")
            .select("id, management_company_id, contract_vehicle_limit")
            .in("management_company_id", companyIds)
            .is("deleted_at", null);
          if (withFixtureFilter) {
            query = query.eq("is_test_fixture", false);
          }
          return query;
        };
        const runQrMetricsQuery = () =>
          client
            .from("qr_assets")
            .select("management_company_id, status")
            .in("management_company_id", companyIds);
        const runContractMetricsQuery = () =>
          client
            .from("contracts")
            .select("management_company_id, plan_code, status, end_date")
            .in("management_company_id", companyIds)
            .is("deleted_at", null);
        let [siteResult, qrResult, contractResult] = await Promise.all([
          runSiteMetricsQuery(hasOperationalIdentityColumns),
          runQrMetricsQuery(),
          runContractMetricsQuery(),
        ]);
        if (siteResult.error?.code === "42703" && hasOperationalIdentityColumns) {
          [siteResult, qrResult, contractResult] = await Promise.all([
            runSiteMetricsQuery(false),
            runQrMetricsQuery(),
            runContractMetricsQuery(),
          ]);
        }
        if (siteResult.error || qrResult.error || contractResult.error) {
          logger.error("admin.management_company_catalog.metrics_failed", {
            errorCode: siteResult.error?.code ?? qrResult.error?.code ?? contractResult.error?.code,
          });
          throw new Error("Unable to load Management Company metrics.");
        }
        for (const companyId of companyIds) {
          metrics.set(companyId, {
            activeContractCount: 0,
            activeQrCount: 0,
            capacityUsagePercent: 0,
            contactCount: 0,
            contractEndsAt: null,
            contractPlan: null,
            contractStatus: null,
            contractVehicleLimit: 0,
            expiredContractCount: 0,
            expiringContractCount: 0,
            ownerResponseCount: 0,
            qrActivationPercent: 0,
            siteCount: 0,
            totalQrCount: 0,
            unresolvedContactCount: 0,
          });
        }
        const siteToCompany = new Map<string, string>();
        for (const site of siteResult.data ?? []) {
          const current = metrics.get(site.management_company_id);
          if (current) {
            current.siteCount += 1;
            current.contractVehicleLimit += site.contract_vehicle_limit;
            siteToCompany.set(site.id, site.management_company_id);
          }
        }
        for (const asset of qrResult.data ?? []) {
          const current = metrics.get(asset.management_company_id);
          if (current) {
            current.totalQrCount += 1;
            if (asset.status === "ACTIVE") {
              current.activeQrCount += 1;
            }
          }
        }
        for (const contract of contractResult.data ?? []) {
          const current = metrics.get(contract.management_company_id);
          if (!current || !isContractStatus(contract.status)) {
            continue;
          }
          const remainingDays = daysUntil(contract.end_date);
          if (contract.status === "ACTIVE") {
            current.activeContractCount += 1;
          }
          if (contract.status === "EXPIRED" || (remainingDays !== null && remainingDays < 0)) {
            current.expiredContractCount += 1;
          } else if (remainingDays !== null && remainingDays <= 30) {
            current.expiringContractCount += 1;
          }
          const previousDays = daysUntil(current.contractEndsAt);
          if (
            !current.contractEndsAt ||
            (remainingDays !== null && (previousDays === null || remainingDays < previousDays))
          ) {
            current.contractEndsAt = contract.end_date;
            current.contractPlan = contract.plan_code;
            current.contractStatus = contract.status;
          }
        }
        if (siteToCompany.size > 0) {
          logger.warn("admin.management_company_catalog.contact_metrics_deferred", {
            reason: "requires_authorized_aggregate",
          });
        }
        for (const current of metrics.values()) {
          current.capacityUsagePercent = clampPercent(
            current.contractVehicleLimit > 0
              ? (current.activeQrCount / current.contractVehicleLimit) * 100
              : 0,
          );
          current.qrActivationPercent = clampPercent(
            current.totalQrCount > 0 ? (current.activeQrCount / current.totalQrCount) * 100 : 0,
          );
        }
      }
      const metricValues = Array.from(metrics.values());
      return {
        activeContractCount: metricValues.reduce(
          (total, metric) => total + metric.activeContractCount,
          0,
        ),
        expiringContractCount: metricValues.reduce(
          (total, metric) => total + metric.expiringContractCount,
          0,
        ),
        expiredContractCount: metricValues.reduce(
          (total, metric) => total + metric.expiredContractCount,
          0,
        ),
        items: rows.map((row) => mapCompanyRow(row, metrics)),
        lowRiskCount: rows.filter((row) => mapCompanyRow(row, metrics).riskLevel === "GOOD").length,
        siteTotal: metricValues.reduce((total, metric) => total + metric.siteCount, 0),
        total: hasOperationalIdentityColumns ? (result.count ?? 0) : rows.length,
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
