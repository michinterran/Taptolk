import "server-only";

import type { SiteCommandResult, SiteManagementRepository } from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export class SiteRepositoryError extends Error {
  readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE";

  constructor(code: SiteRepositoryError["code"]) {
    super(`Site repository failed: ${code}`);
    this.name = "SiteRepositoryError";
    this.code = code;
  }
}

const logger = createLogger({ service: "taptolk-web" });

function readResult(value: unknown): SiteCommandResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { id?: unknown; version?: unknown };
  return typeof candidate.id === "string" && typeof candidate.version === "number"
    ? { id: candidate.id, version: candidate.version }
    : null;
}

function mapError(error: { code?: string; message?: string }): SiteRepositoryError {
  const message = error.message ?? "";
  if (
    message.includes("ACTIVE_CONTRACT_EXISTS") ||
    message.includes("PARENT_NOT_ACTIVE") ||
    message.includes("INACTIVE_OR_INVALID_PARENT")
  ) {
    return new SiteRepositoryError("BLOCKED");
  }
  if (
    error.code === "23505" ||
    error.code === "40001" ||
    message.includes("VERSION_CONFLICT") ||
    message.includes("SITE_CLOSED")
  ) {
    return new SiteRepositoryError("CONFLICT");
  }
  if (error.code === "42501") {
    return new SiteRepositoryError("FORBIDDEN");
  }
  return new SiteRepositoryError("UNAVAILABLE");
}

function assertResult(
  operation: "changeStatus" | "create" | "updateContract" | "updateOperational",
  result: { data: unknown; error: { code?: string; message?: string } | null },
): SiteCommandResult {
  const value = readResult(result.data);
  if (result.error || !value) {
    logger.error("admin.site.command_failed", {
      errorCode: result.error?.code ?? null,
      operation,
    });
    throw result.error ? mapError(result.error) : new SiteRepositoryError("UNAVAILABLE");
  }
  return value;
}

export function createSupabaseSiteManagementRepository(
  client: AdminServerClient,
): SiteManagementRepository {
  return {
    async changeStatus(input) {
      return assertResult(
        "changeStatus",
        await client.rpc("change_site_status", {
          p_expected_version: input.expectedVersion,
          p_next_status: input.nextStatus,
          p_reason: input.reason,
          p_request_id: input.requestId,
          p_site_id: input.siteId,
        }),
      );
    },
    async create(input) {
      return assertResult(
        "create",
        await client.rpc("create_site", {
          p_address: input.address,
          p_contract_vehicle_limit: input.contractVehicleLimit,
          p_management_company_id: input.managementCompanyId,
          p_name: input.name,
          p_reason: input.reason,
          p_request_id: input.requestId,
          p_site_type: input.type,
          p_tenant_id: input.tenantId,
          p_timezone: input.timezone,
        }),
      );
    },
    async updateContract(input) {
      return assertResult(
        "updateContract",
        await client.rpc("update_site_contract", {
          p_contract_vehicle_limit: input.contractVehicleLimit,
          p_expected_version: input.expectedVersion,
          p_reason: input.reason,
          p_request_id: input.requestId,
          p_site_id: input.siteId,
        }),
      );
    },
    async updateOperational(input) {
      return assertResult(
        "updateOperational",
        await client.rpc("update_site_operational", {
          p_address: input.address,
          p_expected_version: input.expectedVersion,
          p_name: input.name,
          p_reason: input.reason,
          p_request_id: input.requestId,
          p_site_id: input.siteId,
          p_site_type: input.type,
          p_timezone: input.timezone,
        }),
      );
    },
  };
}
