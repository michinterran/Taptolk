import "server-only";

import type {
  OrganizationStatus,
  SiteEscalationQueueItem,
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

function isPermissionDenied(error: { code?: string } | null): boolean {
  return error?.code === "42501";
}

function isDeferredEscalationQueueError(error: { code?: string } | null): boolean {
  return error?.code === "42501" || error?.code === "PGRST202";
}
function relationName(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && typeof (row as { name?: unknown }).name === "string"
    ? (row as { name: string }).name
    : null;
}

function isEscalationRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error("SITE_WORKSPACE_UNAVAILABLE");
  }
  return value;
}

function nullableStringField(row: Record<string, unknown>, field: string): string | null {
  const value = row[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("SITE_WORKSPACE_UNAVAILABLE");
  }
  return value;
}

function mapEscalationQueue(value: unknown): readonly SiteEscalationQueueItem[] {
  if (!Array.isArray(value)) {
    throw new Error("SITE_WORKSPACE_UNAVAILABLE");
  }
  return value.map((entry) => {
    if (!isEscalationRow(entry) || entry.status !== "ESCALATED") {
      throw new Error("SITE_WORKSPACE_UNAVAILABLE");
    }
    return {
      createdAt: stringField(entry, "created_at"),
      escalatedAt: stringField(entry, "escalated_at"),
      reasonCode: stringField(entry, "reason_code"),
      sessionId: stringField(entry, "session_id"),
      siteAddress: nullableStringField(entry, "site_address"),
      siteContactLocation: nullableStringField(entry, "site_contact_location"),
      status: "ESCALATED",
      vehiclePlateLast4: stringField(entry, "vehicle_plate_last4"),
    };
  });
}

export function createSupabaseSiteWorkspaceRepository(
  client: AdminServerClient,
): SiteWorkspaceRepository {
  return {
    async read(siteId) {
      const siteResult = await client
        .from("sites")
        .select(
          "id, tenant_id, management_company_id, name, site_type, address, timezone, contract_vehicle_limit, status, version, management_companies!inner(name)",
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
      const [
        qrResult,
        batchResult,
        receiptResult,
        contactResult,
        notificationResult,
        escalationResult,
      ] = await Promise.all([
        client.from("qr_assets").select("status").eq("site_id", siteId),
        client
          .from("qr_batches")
          .select("id, requested_quantity, status, version")
          .eq("site_id", siteId)
          .order("created_at", { ascending: false })
          .limit(5),
        client
          .from("qr_batch_receipts")
          .select("batch_id, received_quantity, created_at")
          .eq("site_id", siteId)
          .order("created_at", { ascending: false }),
        client.from("contact_sessions").select("status").eq("site_id", siteId),
        client
          .from("notification_deliveries")
          .select("status")
          .eq("site_id", siteId)
          .in("status", ["FAILED_RETRYABLE", "FAILED_FINAL"]),
        client.rpc("read_site_escalation_queue", { p_site_id: siteId }),
      ]);
      const failed = [
        qrResult.error,
        batchResult.error,
        receiptResult.error,
        contactResult.error,
        notificationResult.error,
      ].find((error) => error && !isPermissionDenied(error));
      if (failed) {
        logger.error("admin.site_workspace.metrics_failed", { errorCode: failed?.code });
        throw new Error("SITE_WORKSPACE_UNAVAILABLE");
      }
      const deferredMetric = [
        qrResult.error,
        batchResult.error,
        receiptResult.error,
        contactResult.error,
        notificationResult.error,
      ].find(isPermissionDenied);
      if (deferredMetric) {
        logger.warn("admin.site_workspace.metrics_deferred", {
          errorCode: deferredMetric.code,
        });
      }
      let siteEscalations: readonly SiteEscalationQueueItem[] = [];
      if (escalationResult.error) {
        if (!isDeferredEscalationQueueError(escalationResult.error)) {
          logger.warn("admin.site_workspace.escalation_queue_deferred", {
            errorCode: escalationResult.error.code,
          });
        }
      } else {
        siteEscalations = mapEscalationQueue(escalationResult.data);
      }
      const qrRows = qrResult.error ? [] : (qrResult.data ?? []);
      const batchRows = batchResult.error ? [] : (batchResult.data ?? []);
      const receiptRows = receiptResult.error ? [] : (receiptResult.data ?? []);
      const receiptsByBatch = new Map<string, Array<{ createdAt: string; quantity: number }>>();
      for (const receipt of receiptRows) {
        const existing = receiptsByBatch.get(receipt.batch_id) ?? [];
        existing.push({ createdAt: receipt.created_at, quantity: receipt.received_quantity });
        receiptsByBatch.set(receipt.batch_id, existing);
      }
      const contacts = contactResult.error ? [] : (contactResult.data ?? []);
      const failedNotifications = notificationResult.error ? [] : (notificationResult.data ?? []);
      return {
        activeQrCount: qrRows.filter((row) => row.status === "ACTIVE").length,
        address: site.address,
        batches: batchRows.map((row) => {
          const receipts = receiptsByBatch.get(row.id) ?? [];
          const receivedQuantity = receipts.reduce((total, receipt) => total + receipt.quantity, 0);
          const remainingQuantity = Math.max(0, row.requested_quantity - receivedQuantity);
          return {
            id: row.id,
            quantity: row.requested_quantity,
            receivedQuantity,
            remainingQuantity,
            receipts,
            status:
              row.status === "DELIVERED" && receivedQuantity > 0 && remainingQuantity > 0
                ? "PARTIALLY_RECEIVED"
                : row.status,
            version: row.version,
          };
        }),
        contactCount: contacts.length,
        contractVehicleLimit: site.contract_vehicle_limit,
        failedNotificationCount: failedNotifications.length,
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
        siteEscalations,
        status: site.status,
        tenantId: site.tenant_id,
        totalQrCount: qrRows.length,
        type: site.site_type,
        timezone: site.timezone,
        version: site.version,
      } satisfies SiteWorkspace;
    },
  };
}
