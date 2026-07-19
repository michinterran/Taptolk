import "server-only";

import type {
  ManagementCompanyCommandResult,
  ManagementCompanyManagementRepository,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export class ManagementCompanyRepositoryError extends Error {
  readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE";

  constructor(code: ManagementCompanyRepositoryError["code"]) {
    super(`Management Company repository failed: ${code}`);
    this.name = "ManagementCompanyRepositoryError";
    this.code = code;
  }
}

const logger = createLogger({ service: "taptolk-web" });

function readResult(value: unknown): ManagementCompanyCommandResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { id?: unknown; version?: unknown };
  return typeof candidate.id === "string" && typeof candidate.version === "number"
    ? { id: candidate.id, version: candidate.version }
    : null;
}

function mapError(error: { code?: string; message?: string }): ManagementCompanyRepositoryError {
  const message = error.message ?? "";
  if (message.includes("ACTIVE_SITE_EXISTS") || message.includes("PARENT_TENANT_NOT_ACTIVE")) {
    return new ManagementCompanyRepositoryError("BLOCKED");
  }
  if (
    error.code === "23505" ||
    error.code === "40001" ||
    message.includes("VERSION_CONFLICT") ||
    message.includes("COMPANY_CLOSED")
  ) {
    return new ManagementCompanyRepositoryError("CONFLICT");
  }
  if (error.code === "42501") {
    return new ManagementCompanyRepositoryError("FORBIDDEN");
  }
  return new ManagementCompanyRepositoryError("UNAVAILABLE");
}

function assertResult(
  operation: "changeStatus" | "create" | "update",
  result: { data: unknown; error: { code?: string; message?: string } | null },
): ManagementCompanyCommandResult {
  const value = readResult(result.data);
  if (result.error || !value) {
    logger.error("admin.management_company.command_failed", {
      errorCode: result.error?.code ?? null,
      operation,
    });
    throw result.error
      ? mapError(result.error)
      : new ManagementCompanyRepositoryError("UNAVAILABLE");
  }
  return value;
}

export function createSupabaseManagementCompanyManagementRepository(
  client: AdminServerClient,
): ManagementCompanyManagementRepository {
  return {
    async changeStatus(input) {
      return assertResult(
        "changeStatus",
        await client.rpc("change_management_company_status", {
          p_company_id: input.companyId,
          p_expected_version: input.expectedVersion,
          p_next_status: input.nextStatus,
          p_reason: input.reason,
          p_request_id: input.requestId,
        }),
      );
    },
    async create(input) {
      return assertResult(
        "create",
        await client.rpc("create_management_company", {
          p_business_number: input.businessNumber,
          p_name: input.name,
          p_reason: input.reason,
          p_request_id: input.requestId,
          p_tenant_id: input.tenantId,
        }),
      );
    },
    async update(input) {
      return assertResult(
        "update",
        await client.rpc("update_management_company", {
          p_business_number: input.businessNumber,
          p_company_id: input.companyId,
          p_expected_version: input.expectedVersion,
          p_name: input.name,
          p_reason: input.reason,
          p_request_id: input.requestId,
        }),
      );
    },
  };
}
