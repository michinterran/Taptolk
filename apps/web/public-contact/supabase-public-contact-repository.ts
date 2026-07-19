import "server-only";

import type {
  PublicContactRepository,
  PublicContactRepositoryCreateResult,
  PublicContactSessionReadModel,
  PublicQrContactInspection,
} from "@taptolk/application";
import { CONTACT_REASON_CODES, type PublicContactStatus } from "@taptolk/domain";
import { createLogger } from "@taptolk/observability";
import type { createAdminServiceClient } from "../auth/service-client";

type ServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;
const logger = createLogger({ service: "taptolk-web" });

const PUBLIC_STATUSES = new Set<PublicContactStatus>([
  "BLOCKED",
  "CALLER_VIEWED",
  "CANCELLED",
  "ESCALATED",
  "EXPIRED",
  "NOTIFICATION_FAILED",
  "NOTIFICATION_QUEUED",
  "OWNER_NOTIFIED",
  "OWNER_REPLIED",
  "OWNER_VIEWED",
  "RESOLVED",
]);

export class PublicContactRepositoryError extends Error {
  constructor(readonly code: "CONFLICT" | "INVALID" | "LIMITED" | "UNAVAILABLE") {
    super(`Public contact repository failed: ${code}`);
    this.name = "PublicContactRepositoryError";
  }
}

function mapError(error: { code?: string; message?: string } | null): PublicContactRepositoryError {
  logger.error("public_contact.repository_failed", {
    errorCode: error?.code ?? null,
  });
  const message = error?.message ?? "";
  if (message.includes("RATE_LIMIT")) {
    return new PublicContactRepositoryError("LIMITED");
  }
  if (message.includes("CONFLICT") || error?.code === "23505") {
    return new PublicContactRepositoryError("CONFLICT");
  }
  if (
    error?.code === "22023" ||
    error?.code === "P0002" ||
    message.includes("INVALID") ||
    message.includes("UNAVAILABLE")
  ) {
    return new PublicContactRepositoryError("INVALID");
  }
  return new PublicContactRepositoryError("UNAVAILABLE");
}

function objectRow(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicContactRepositoryError("UNAVAILABLE");
  }
  return value as Record<string, unknown>;
}

function stringField(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new PublicContactRepositoryError("UNAVAILABLE");
  }
  return value;
}

function resultData(result: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}): Record<string, unknown> {
  if (result.error) {
    throw mapError(result.error);
  }
  return objectRow(result.data);
}

function sessionReadModel(row: Record<string, unknown>): PublicContactSessionReadModel {
  const status = row.status;
  const reasonCode = row.reason_code;
  const callerMessageCount = row.caller_message_count;
  const version = row.version;
  if (
    typeof status !== "string" ||
    !PUBLIC_STATUSES.has(status as PublicContactStatus) ||
    typeof reasonCode !== "string" ||
    !CONTACT_REASON_CODES.includes(reasonCode as (typeof CONTACT_REASON_CODES)[number]) ||
    typeof callerMessageCount !== "number" ||
    typeof version !== "number" ||
    !Array.isArray(row.owner_messages)
  ) {
    throw new PublicContactRepositoryError("UNAVAILABLE");
  }
  const ownerMessages = row.owner_messages.map((value) => {
    const message = objectRow(value);
    const replyCode = message.reply_code;
    if (replyCode !== null && typeof replyCode !== "string") {
      throw new PublicContactRepositoryError("UNAVAILABLE");
    }
    return {
      body: stringField(message, "body"),
      createdAt: stringField(message, "created_at"),
      replyCode,
    };
  });
  return {
    callerMessageCount,
    expiresAt: stringField(row, "expires_at"),
    ownerMessages,
    reasonCode: reasonCode as (typeof CONTACT_REASON_CODES)[number],
    status: status as PublicContactStatus,
    version,
  };
}

export function createSupabasePublicContactRepository(
  client: ServiceClient,
): PublicContactRepository {
  return {
    async create(input): Promise<PublicContactRepositoryCreateResult> {
      const row = resultData(
        await client.rpc("create_public_contact_session", {
          p_input: {
            anonymous_global_limit: input.policy.anonymousGlobalLimit,
            anonymous_global_window_seconds: input.policy.anonymousGlobalWindowSeconds,
            anonymous_token_hash: input.anonymousTokenHash,
            duplicate_merge_seconds: input.policy.duplicateMergeSeconds,
            idempotency_key: input.idempotencyKey,
            ip_qr_limit: input.policy.ipQrLimit,
            ip_qr_window_seconds: input.policy.ipQrWindowSeconds,
            message: input.message,
            message_hash: input.messageHash,
            message_mode: input.messageMode,
            network_hash: input.networkHash,
            plate_last4: input.plateLast4,
            public_token_hash: input.publicTokenHash,
            qr_global_limit: input.policy.qrGlobalLimit,
            qr_global_window_seconds: input.policy.qrGlobalWindowSeconds,
            reason_code: input.reasonCode,
            session_token_hash: input.sessionTokenHash,
            session_ttl_seconds: input.policy.sessionTtlSeconds,
            user_agent_hash: input.userAgentHash,
          },
        }),
      );
      if (typeof row.merged !== "boolean") {
        throw new PublicContactRepositoryError("UNAVAILABLE");
      }
      return { ...sessionReadModel(row), merged: row.merged };
    },
    async inspect(input): Promise<PublicQrContactInspection> {
      const row = resultData(
        await client.rpc("inspect_public_contact", {
          p_public_token_hash: input.publicTokenHash,
        }),
      );
      const vehicle = objectRow(row.vehicle);
      if (
        row.qr_status !== "ACTIVE" ||
        row.contact_enabled !== true ||
        (vehicle.color !== null && typeof vehicle.color !== "string") ||
        (vehicle.type !== null && typeof vehicle.type !== "string")
      ) {
        throw new PublicContactRepositoryError("UNAVAILABLE");
      }
      return {
        contactEnabled: true,
        qrStatus: "ACTIVE",
        siteDisplayName: stringField(row, "site_display_name"),
        vehicle: {
          color: vehicle.color,
          plateLast4: stringField(vehicle, "plate_last4"),
          type: vehicle.type,
        },
      };
    },
    async read(input): Promise<PublicContactSessionReadModel> {
      return sessionReadModel(
        resultData(
          await client.rpc("read_public_contact_session", {
            p_anonymous_token_hash: input.anonymousTokenHash,
            p_session_token_hash: input.sessionTokenHash,
          }),
        ),
      );
    },
  };
}
