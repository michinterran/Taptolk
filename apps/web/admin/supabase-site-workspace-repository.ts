import "server-only";

import type {
  OrganizationStatus,
  SiteType,
  SiteWorkspace,
  SiteWorkspaceRepository,
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
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && typeof (row as { name?: unknown }).name === "string"
    ? (row as { name: string }).name
    : null;
}

export function createSupabaseSiteWorkspaceRepository(
  client: AdminServerClient,
): SiteWorkspaceRepository {
  return {
    async read(siteId) {
      const siteResult = await client
        .from("sites")
        .select(
          "id, tenant_id, management_company_id, name, site_type, address, contract_vehicle_limit, status, management_companies!inner(name)",
        )
        .eq("id", siteId)
        .is("deleted_at", null)
        .maybeSingle();
      if (siteResult.error) {
        logger.error("admin.site_workspace.site_failed", { errorCode: siteResult.error.code });
        throw new Error("SITE_WORKSPACE_UNAVAILABLE");
      }
      const site = siteResult.data;
      if (!site) return null;
      const companyName = relationName(site.management_companies);
      if (!companyName || !isStatus(site.status) || !isSiteType(site.site_type))
        throw new Error("SITE_WORKSPACE_UNAVAILABLE");
      const [qrResult, batchResult, contactResult, notificationResult] = await Promise.all([
        client.from("qr_assets").select("status").eq("site_id", siteId),
        client
          .from("qr_batches")
          .select("id, requested_quantity, status")
          .eq("site_id", siteId)
          .order("created_at", { ascending: false })
          .limit(5),
        client.from("contact_sessions").select("status").eq("site_id", siteId),
        client
          .from("notification_deliveries")
          .select("status")
          .eq("site_id", siteId)
          .eq("status", "FAILED"),
      ]);
      const failed = [
        qrResult.error,
        batchResult.error,
        contactResult.error,
        notificationResult.error,
      ].find(Boolean);
      if (failed) {
        logger.error("admin.site_workspace.metrics_failed", { errorCode: failed?.code });
        throw new Error("SITE_WORKSPACE_UNAVAILABLE");
      }
      const qrRows = qrResult.data ?? [];
      const contacts = contactResult.data ?? [];
      return {
        activeQrCount: qrRows.filter((row) => row.status === "ACTIVE").length,
        address: site.address,
        batches: (batchResult.data ?? []).map((row) => ({
          id: row.id,
          quantity: row.requested_quantity,
          status: row.status,
        })),
        contactCount: contacts.length,
        contractVehicleLimit: site.contract_vehicle_limit,
        failedNotificationCount: notificationResult.data?.length ?? 0,
        id: site.id,
        managementCompanyId: site.management_company_id,
        managementCompanyName: companyName,
        name: site.name,
        openContactCount: contacts.filter(
          (row) =>
            row.status !== "RESOLVED" &&
            row.status !== "EXPIRED" &&
            row.status !== "BLOCKED" &&
            row.status !== "CANCELLED",
        ).length,
        status: site.status,
        tenantId: site.tenant_id,
        totalQrCount: qrRows.length,
        type: site.site_type,
      } satisfies SiteWorkspace;
    },
  };
}
