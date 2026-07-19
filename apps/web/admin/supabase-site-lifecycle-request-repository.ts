import "server-only";

import type {
  SiteLifecycleAction,
  SiteLifecycleCommandResult,
  SiteLifecycleRequestItem,
  SiteLifecycleRequestRepository,
  SiteLifecycleRequestStatus,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export class SiteLifecycleRequestRepositoryError extends Error {
  readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE";

  constructor(code: SiteLifecycleRequestRepositoryError["code"]) {
    super(`Site lifecycle request repository failed: ${code}`);
    this.name = "SiteLifecycleRequestRepositoryError";
    this.code = code;
  }
}

const logger = createLogger({ service: "taptolk-web" });

function isAction(value: unknown): value is SiteLifecycleAction {
  return value === "SUSPEND" || value === "REACTIVATE" || value === "CLOSE";
}

function isStatus(value: unknown): value is SiteLifecycleRequestStatus {
  return (
    value === "PENDING" || value === "APPROVED" || value === "REJECTED" || value === "CANCELLED"
  );
}

function readRelation(value: unknown): Record<string, unknown> | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}

function mapRequestRow(row: unknown): SiteLifecycleRequestItem {
  if (!row || typeof row !== "object") {
    throw new SiteLifecycleRequestRepositoryError("UNAVAILABLE");
  }
  const candidate = row as Record<string, unknown>;
  const site = readRelation(candidate.sites);
  const company = readRelation(site?.management_companies);
  const tenant = readRelation(company?.tenants);
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    typeof candidate.management_company_id !== "string" ||
    typeof candidate.site_id !== "string" ||
    typeof candidate.requested_site_version !== "number" ||
    typeof candidate.requested_by !== "string" ||
    typeof candidate.request_reason !== "string" ||
    typeof candidate.version !== "number" ||
    typeof candidate.created_at !== "string" ||
    typeof site?.name !== "string" ||
    typeof company?.name !== "string" ||
    typeof tenant?.name !== "string" ||
    !isAction(candidate.action) ||
    !isStatus(candidate.status)
  ) {
    throw new SiteLifecycleRequestRepositoryError("UNAVAILABLE");
  }
  return {
    action: candidate.action,
    createdAt: candidate.created_at,
    id: candidate.id,
    managementCompanyId: candidate.management_company_id,
    managementCompanyName: company.name,
    reason: candidate.request_reason,
    requestedBy: candidate.requested_by,
    requestedSiteVersion: candidate.requested_site_version,
    siteId: candidate.site_id,
    siteName: site.name,
    status: candidate.status,
    tenantId: candidate.tenant_id,
    tenantName: tenant.name,
    version: candidate.version,
  };
}

function readCommandResult(value: unknown): SiteLifecycleCommandResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.requestId !== "string" ||
    typeof candidate.requestVersion !== "number" ||
    typeof candidate.siteId !== "string" ||
    (candidate.siteVersion !== null && typeof candidate.siteVersion !== "number")
  ) {
    return null;
  }
  return {
    requestId: candidate.requestId,
    requestVersion: candidate.requestVersion,
    siteId: candidate.siteId,
    siteVersion: candidate.siteVersion,
  };
}

function mapError(error: { code?: string; message?: string }): SiteLifecycleRequestRepositoryError {
  const message = error.message ?? "";
  if (message.includes("ACTIVE_CONTRACT_EXISTS") || message.includes("PARENT_NOT_ACTIVE")) {
    return new SiteLifecycleRequestRepositoryError("BLOCKED");
  }
  if (
    error.code === "23505" ||
    error.code === "40001" ||
    message.includes("VERSION_CONFLICT") ||
    message.includes("PENDING_REQUEST_EXISTS") ||
    message.includes("REQUEST_TERMINAL")
  ) {
    return new SiteLifecycleRequestRepositoryError("CONFLICT");
  }
  if (error.code === "42501") {
    return new SiteLifecycleRequestRepositoryError("FORBIDDEN");
  }
  return new SiteLifecycleRequestRepositoryError("UNAVAILABLE");
}

function assertCommandResult(
  operation: "approve" | "cancel" | "reject" | "request",
  result: { data: unknown; error: { code?: string; message?: string } | null },
): SiteLifecycleCommandResult {
  const value = readCommandResult(result.data);
  if (result.error || !value) {
    logger.error("admin.site_lifecycle_request.command_failed", {
      errorCode: result.error?.code ?? null,
      operation,
    });
    throw result.error
      ? mapError(result.error)
      : new SiteLifecycleRequestRepositoryError("UNAVAILABLE");
  }
  return value;
}

export function createSupabaseSiteLifecycleRequestRepository(
  client: AdminServerClient,
): SiteLifecycleRequestRepository {
  return {
    async approve(input) {
      return assertCommandResult(
        "approve",
        await client.rpc("approve_site_lifecycle_request", {
          p_expected_request_version: input.expectedRequestVersion,
          p_lifecycle_request_id: input.lifecycleRequestId,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async cancel(input) {
      return assertCommandResult(
        "cancel",
        await client.rpc("cancel_site_lifecycle_request", {
          p_expected_request_version: input.expectedRequestVersion,
          p_lifecycle_request_id: input.lifecycleRequestId,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async listPending() {
      const result = await client
        .from("site_lifecycle_requests")
        .select(
          "id, tenant_id, management_company_id, site_id, action, status, requested_site_version, requested_by, request_reason, version, created_at, sites!inner(name, management_companies!inner(name, tenants!inner(name)))",
        )
        .eq("status", "PENDING")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(100);
      if (result.error) {
        logger.error("admin.site_lifecycle_request.query_failed", {
          errorCode: result.error.code,
        });
        throw new SiteLifecycleRequestRepositoryError("UNAVAILABLE");
      }
      return (result.data ?? []).map(mapRequestRow);
    },
    async reject(input) {
      return assertCommandResult(
        "reject",
        await client.rpc("reject_site_lifecycle_request", {
          p_expected_request_version: input.expectedRequestVersion,
          p_lifecycle_request_id: input.lifecycleRequestId,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async request(input) {
      return assertCommandResult(
        "request",
        await client.rpc("request_site_lifecycle", {
          p_action: input.action,
          p_expected_site_version: input.expectedSiteVersion,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
          p_site_id: input.siteId,
        }),
      );
    },
  };
}
