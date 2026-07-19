import "server-only";

import type { TenantCommandResult, TenantManagementRepository } from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export class TenantManagementRepositoryError extends Error {
  readonly code: "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE";

  constructor(code: TenantManagementRepositoryError["code"]) {
    super(`Tenant management repository failed: ${code}`);
    this.name = "TenantManagementRepositoryError";
    this.code = code;
  }
}

const logger = createLogger({ service: "taptolk-web" });

function readResult(value: unknown): TenantCommandResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { id?: unknown; version?: unknown };
  return typeof candidate.id === "string" && typeof candidate.version === "number"
    ? { id: candidate.id, version: candidate.version }
    : null;
}

function mapError(error: { code?: string; message?: string }): TenantManagementRepositoryError {
  const message = error.message ?? "";
  if (
    error.code === "23505" ||
    error.code === "40001" ||
    message.includes("VERSION_CONFLICT") ||
    message.includes("TENANT_CLOSED")
  ) {
    return new TenantManagementRepositoryError("CONFLICT");
  }
  if (error.code === "42501") {
    return new TenantManagementRepositoryError("FORBIDDEN");
  }
  return new TenantManagementRepositoryError("UNAVAILABLE");
}

function assertRpcResult(
  operation: "changeStatus" | "create" | "update",
  result: { data: unknown; error: { code?: string; message?: string } | null },
): TenantCommandResult {
  const commandResult = readResult(result.data);
  if (result.error || !commandResult) {
    logger.error("admin.tenant_management.command_failed", {
      errorCode: result.error?.code ?? null,
      operation,
    });
    throw result.error
      ? mapError(result.error)
      : new TenantManagementRepositoryError("UNAVAILABLE");
  }
  return commandResult;
}

export function createSupabaseTenantManagementRepository(
  client: AdminServerClient,
): TenantManagementRepository {
  return {
    async changeStatus(input) {
      return assertRpcResult(
        "changeStatus",
        await client.rpc("change_tenant_status", {
          p_expected_version: input.expectedVersion,
          p_next_status: input.nextStatus,
          p_reason: input.reason,
          p_request_id: input.requestId,
          p_tenant_id: input.tenantId,
        }),
      );
    },
    async create(input) {
      return assertRpcResult(
        "create",
        await client.rpc("create_tenant", {
          p_name: input.name,
          p_reason: input.reason,
          p_request_id: input.requestId,
          p_slug: input.slug,
        }),
      );
    },
    async update(input) {
      return assertRpcResult(
        "update",
        await client.rpc("update_tenant", {
          p_expected_version: input.expectedVersion,
          p_name: input.name,
          p_reason: input.reason,
          p_request_id: input.requestId,
          p_slug: input.slug,
          p_tenant_id: input.tenantId,
        }),
      );
    },
  };
}
