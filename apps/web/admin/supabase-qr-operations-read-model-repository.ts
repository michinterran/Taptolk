import "server-only";

import type {
  OrganizationStatus,
  QrAssetStatus,
  QrBatchStatus,
  QrOperationsBatch,
  QrOperationsCompany,
  QrOperationsReadModel,
  QrOperationsReadModelRepository,
  QrOperationsSite,
  SiteType,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

const logger = createLogger({ service: "taptolk-web" });

type CompanyRow = {
  address?: string | null;
  id: string;
  management_code?: string | null;
  name: string;
  status: OrganizationStatus;
  tenant_id: string;
};

type SiteRow = {
  address?: string | null;
  contract_vehicle_limit: number;
  id: string;
  management_code?: string | null;
  management_company_id: string;
  name: string;
  site_type: SiteType;
  status: OrganizationStatus;
  tenant_id: string;
  version: number;
};

type AssetRow = {
  batch_id: string;
  management_company_id: string;
  site_id: string;
  status: QrAssetStatus;
  tenant_id: string;
};

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isStatus(value: unknown): value is OrganizationStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "CLOSED";
}

function isSiteType(value: unknown): value is SiteType {
  return (
    value === "APARTMENT" || value === "OFFICETEL" || value === "BUILDING" || value === "OTHER"
  );
}

function isQrAssetStatus(value: unknown): value is QrAssetStatus {
  return [
    "GENERATED",
    "PRINT_READY",
    "PRINTED",
    "IN_STOCK",
    "ASSIGNED",
    "ACTIVATION_PENDING",
    "ACTIVE",
    "SUSPENDED",
    "LOST",
    "DAMAGED",
    "REPLACED",
    "REVOKED",
    "EXPIRED",
  ].includes(String(value));
}

function isBatchStatus(value: unknown): value is QrBatchStatus {
  return [
    "DRAFT",
    "SAMPLE_RENDERING",
    "SAMPLE_READY",
    "SAMPLE_APPROVED",
    "FINAL_APPROVAL_PENDING",
    "GENERATION_APPROVED",
    "GENERATION_QUEUED",
    "GENERATING",
    "GENERATED",
    "QUALITY_CHECKED",
    "PRINT_FILE_READY",
    "SENT_TO_PRINTER",
    "PRINTED",
    "SHIPPED",
    "DELIVERED",
    "DISTRIBUTING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "PARTIALLY_COMPLETED",
  ].includes(String(value));
}

function isExportType(value: unknown): value is "CSV" | "MANIFEST" | "PDF" | "ZIP" {
  return value === "CSV" || value === "MANIFEST" || value === "PDF" || value === "ZIP";
}

function normalizeExportTypes(value: unknown): readonly ("CSV" | "MANIFEST" | "PDF" | "ZIP")[] {
  return Array.isArray(value) ? value.filter(isExportType) : [];
}

function nullableNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function isNullableStringValue(value: unknown): boolean {
  return value === null || value === undefined || typeof value === "string";
}

function isNullableNumberValue(value: unknown): boolean {
  return value === null || value === undefined || typeof value === "number";
}

function mapCompany(row: Record<string, unknown>): CompanyRow {
  if (
    typeof row.id !== "string" ||
    typeof row.tenant_id !== "string" ||
    typeof row.name !== "string" ||
    !isStatus(row.status)
  ) {
    throw new Error("QR_OPERATIONS_UNAVAILABLE");
  }
  return {
    address: nullableString(row.address),
    id: row.id,
    management_code: nullableString(row.management_code),
    name: row.name,
    status: row.status,
    tenant_id: row.tenant_id,
  };
}

function mapSite(row: Record<string, unknown>): SiteRow {
  if (
    typeof row.id !== "string" ||
    typeof row.tenant_id !== "string" ||
    typeof row.management_company_id !== "string" ||
    typeof row.name !== "string" ||
    !isSiteType(row.site_type) ||
    !isStatus(row.status) ||
    typeof row.contract_vehicle_limit !== "number" ||
    typeof row.version !== "number"
  ) {
    throw new Error("QR_OPERATIONS_UNAVAILABLE");
  }
  return {
    address: nullableString(row.address),
    contract_vehicle_limit: row.contract_vehicle_limit,
    id: row.id,
    management_code: nullableString(row.management_code),
    management_company_id: row.management_company_id,
    name: row.name,
    site_type: row.site_type,
    status: row.status,
    tenant_id: row.tenant_id,
    version: row.version,
  };
}

function mapAsset(row: Record<string, unknown>): AssetRow {
  if (
    typeof row.tenant_id !== "string" ||
    typeof row.management_company_id !== "string" ||
    typeof row.site_id !== "string" ||
    typeof row.batch_id !== "string" ||
    !isQrAssetStatus(row.status)
  ) {
    throw new Error("QR_OPERATIONS_UNAVAILABLE");
  }
  return {
    batch_id: row.batch_id,
    management_company_id: row.management_company_id,
    site_id: row.site_id,
    status: row.status,
    tenant_id: row.tenant_id,
  };
}

function mapBatch(value: unknown): QrOperationsBatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("QR_OPERATIONS_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  const exportTypes = normalizeExportTypes(row.export_types);
  if (
    typeof row.id !== "string" ||
    typeof row.management_company_id !== "string" ||
    typeof row.site_id !== "string" ||
    !isNullableStringValue(row.direct_generation_request_id) ||
    typeof row.site_name !== "string" ||
    typeof row.batch_code !== "string" ||
    typeof row.requested_quantity !== "number" ||
    typeof row.generated_quantity !== "number" ||
    typeof row.rendered_quantity !== "number" ||
    typeof row.passed_quantity !== "number" ||
    typeof row.failed_quantity !== "number" ||
    typeof row.version !== "number" ||
    typeof row.created_at !== "string" ||
    !isBatchStatus(row.status) ||
    !isNullableStringValue(row.job_status) ||
    !isNullableNumberValue(row.processed_count) ||
    !isNullableNumberValue(row.execution_attempt_count) ||
    !isNullableNumberValue(row.job_passed_count) ||
    !isNullableNumberValue(row.job_failed_count)
  ) {
    throw new Error("QR_OPERATIONS_UNAVAILABLE");
  }
  const downloadReady =
    row.generated_quantity === row.requested_quantity &&
    row.rendered_quantity === row.requested_quantity &&
    row.passed_quantity === row.requested_quantity &&
    exportTypes.includes("ZIP");
  return {
    batchCode: row.batch_code,
    createdAt: row.created_at,
    directGenerationRequestId: nullableString(row.direct_generation_request_id),
    downloadReady,
    executionAttemptCount: optionalNumber(row.execution_attempt_count),
    exportTypes,
    failedQuantity: row.failed_quantity,
    generatedQuantity: row.generated_quantity,
    id: row.id,
    jobFailedQuantity: nullableNumber(row.job_failed_count),
    jobPassedQuantity: nullableNumber(row.job_passed_count),
    jobStatus: nullableString(row.job_status),
    managementCompanyId: row.management_company_id,
    passedQuantity: row.passed_quantity,
    processedCount: optionalNumber(row.processed_count),
    renderedQuantity: row.rendered_quantity,
    requestedQuantity: row.requested_quantity,
    siteId: row.site_id,
    siteName: row.site_name,
    status: row.status,
    version: row.version,
  };
}

function countByStatus(rows: readonly AssetRow[]) {
  return rows.reduce(
    (memo, row) => {
      memo.total += 1;
      if (row.status === "ACTIVE") memo.active += 1;
      if (row.status === "ACTIVATION_PENDING") memo.pendingActivation += 1;
      if (
        row.status === "GENERATED" ||
        row.status === "PRINT_READY" ||
        row.status === "PRINTED" ||
        row.status === "IN_STOCK" ||
        row.status === "ASSIGNED" ||
        row.status === "ACTIVATION_PENDING" ||
        row.status === "ACTIVE"
      ) {
        memo.generated += 1;
      }
      return memo;
    },
    { active: 0, generated: 0, pendingActivation: 0, total: 0 },
  );
}

async function readCompanies(client: AdminServerClient): Promise<readonly CompanyRow[]> {
  const withOperationalColumns = () =>
    client
      .from("management_companies")
      .select("id, tenant_id, name, management_code, address, status, is_test_fixture")
      .is("deleted_at", null)
      .eq("is_test_fixture", false)
      .order("name", { ascending: true });
  const result = await withOperationalColumns();
  if (result.error || !Array.isArray(result.data)) {
    logger.error("admin.qr_operations.companies_failed", {
      errorCode: result.error?.code ?? null,
    });
    throw new Error("QR_OPERATIONS_UNAVAILABLE");
  }
  return (result.data as Array<Record<string, unknown>>).map(mapCompany);
}

async function readSites(client: AdminServerClient): Promise<readonly SiteRow[]> {
  const withOperationalColumns = () =>
    client
      .from("sites")
      .select(
        "id, tenant_id, management_company_id, name, management_code, address, site_type, status, contract_vehicle_limit, version, is_test_fixture",
      )
      .is("deleted_at", null)
      .eq("is_test_fixture", false)
      .order("name", { ascending: true });
  const result = await withOperationalColumns();
  if (result.error || !Array.isArray(result.data)) {
    logger.error("admin.qr_operations.sites_failed", {
      errorCode: result.error?.code ?? null,
    });
    throw new Error("QR_OPERATIONS_UNAVAILABLE");
  }
  return (result.data as Array<Record<string, unknown>>).map(mapSite);
}

async function readAssets(client: AdminServerClient): Promise<readonly AssetRow[]> {
  const result = await client
    .from("qr_assets")
    .select("tenant_id, management_company_id, site_id, batch_id, status");
  if (result.error || !Array.isArray(result.data)) {
    logger.error("admin.qr_operations.assets_failed", {
      errorCode: result.error?.code ?? null,
    });
    throw new Error("QR_OPERATIONS_UNAVAILABLE");
  }
  return (result.data as Array<Record<string, unknown>>).map(mapAsset);
}

async function readBatches(client: AdminServerClient): Promise<readonly QrOperationsBatch[]> {
  const [progressResult, pendingResult] = await Promise.all([
    client.rpc("list_qr_batch_progress_read_model"),
    client.rpc("list_qr_pending_batch_progress_read_model"),
  ]);
  if (
    progressResult.error ||
    pendingResult.error ||
    !Array.isArray(progressResult.data) ||
    !Array.isArray(pendingResult.data)
  ) {
    logger.error("admin.qr_operations.batches_failed", {
      errorCode: progressResult.error?.code ?? pendingResult.error?.code ?? null,
    });
    throw new Error("QR_OPERATIONS_UNAVAILABLE");
  }
  return [...progressResult.data, ...pendingResult.data].map(mapBatch);
}

export function createSupabaseQrOperationsReadModelRepository(
  client: AdminServerClient,
): QrOperationsReadModelRepository {
  return {
    async read(): Promise<QrOperationsReadModel> {
      const [companies, sites, assets, batches] = await Promise.all([
        readCompanies(client),
        readSites(client),
        readAssets(client),
        readBatches(client),
      ]);
      const companyIds = new Set(companies.map((company) => company.id));
      const visibleSites = sites.filter((site) => companyIds.has(site.management_company_id));
      const siteIds = new Set(visibleSites.map((site) => site.id));
      const visibleAssets = assets.filter((asset) => siteIds.has(asset.site_id));
      const visibleBatches = batches.filter((batch) => siteIds.has(batch.siteId));

      const assetsBySite = new Map<string, AssetRow[]>();
      const assetsByCompany = new Map<string, AssetRow[]>();
      for (const asset of visibleAssets) {
        assetsBySite.set(asset.site_id, [...(assetsBySite.get(asset.site_id) ?? []), asset]);
        assetsByCompany.set(asset.management_company_id, [
          ...(assetsByCompany.get(asset.management_company_id) ?? []),
          asset,
        ]);
      }
      const batchesBySite = new Map<string, number>();
      for (const batch of visibleBatches) {
        batchesBySite.set(batch.siteId, (batchesBySite.get(batch.siteId) ?? 0) + 1);
      }

      const sitesByCompany = new Map<string, SiteRow[]>();
      for (const site of visibleSites) {
        sitesByCompany.set(site.management_company_id, [
          ...(sitesByCompany.get(site.management_company_id) ?? []),
          site,
        ]);
      }

      const modelSites: QrOperationsSite[] = visibleSites.map((site) => {
        const counts = countByStatus(assetsBySite.get(site.id) ?? []);
        return {
          activeQr: counts.active,
          address: site.address ?? null,
          batchCount: batchesBySite.get(site.id) ?? 0,
          contractVehicleLimit: site.contract_vehicle_limit,
          generatedQr: counts.generated,
          id: site.id,
          managementCode: site.management_code ?? null,
          managementCompanyId: site.management_company_id,
          name: site.name,
          pendingActivationQr: counts.pendingActivation,
          status: site.status,
          tenantId: site.tenant_id,
          totalQr: counts.total,
          type: site.site_type,
          version: site.version,
        };
      });
      const modelCompanies: QrOperationsCompany[] = companies.map((company) => {
        const counts = countByStatus(assetsByCompany.get(company.id) ?? []);
        return {
          activeQr: counts.active,
          address: company.address ?? null,
          contractVehicleLimit: (sitesByCompany.get(company.id) ?? []).reduce(
            (sum, site) => sum + site.contract_vehicle_limit,
            0,
          ),
          id: company.id,
          managementCode: company.management_code ?? null,
          name: company.name,
          siteCount: sitesByCompany.get(company.id)?.length ?? 0,
          status: company.status,
          tenantId: company.tenant_id,
          totalQr: counts.total,
        };
      });
      const totals = countByStatus(visibleAssets);

      return {
        batches: visibleBatches,
        companies: modelCompanies,
        sites: modelSites,
        totals: {
          activeQr: totals.active,
          completedBatches: visibleBatches.filter((batch) => batch.status === "COMPLETED").length,
          generatedQr: totals.generated,
          pendingActivationQr: totals.pendingActivation,
          siteCount: modelSites.length,
          totalBatches: visibleBatches.length,
          totalCompanies: modelCompanies.length,
          totalQr: totals.total,
        },
      };
    },
  };
}
