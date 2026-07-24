import "server-only";

import type {
  OwnerActivationCompletion,
  OwnerActivationInspection,
  OwnerActivationRepository,
  OwnerOtpRequestResult,
  OwnerOtpVerificationResult,
  OwnerReclaimVerificationResult,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServiceClient } from "../auth/service-client";

type ServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;
const logger = createLogger({ service: "taptolk-web" });

export class OwnerActivationRepositoryError extends Error {
  constructor(readonly code: "CONFLICT" | "INVALID" | "LIMITED" | "UNAVAILABLE") {
    super(`Owner activation repository failed: ${code}`);
    this.name = "OwnerActivationRepositoryError";
  }
}

function mapError(
  error: { code?: string; message?: string } | null,
): OwnerActivationRepositoryError {
  logger.error("owner_activation.repository_failed", {
    errorCode: error?.code ?? null,
  });
  const message = error?.message ?? "";
  if (message.includes("LIMIT") || message.includes("COOLDOWN") || message.includes("OTP_LOCKED")) {
    return new OwnerActivationRepositoryError("LIMITED");
  }
  if (error?.code === "23505" || message.includes("CONFLICT") || message.includes("BOUND")) {
    return new OwnerActivationRepositoryError("CONFLICT");
  }
  if (
    error?.code === "22023" ||
    error?.code === "P0002" ||
    message.includes("INVALID") ||
    message.includes("UNAVAILABLE")
  ) {
    return new OwnerActivationRepositoryError("INVALID");
  }
  return new OwnerActivationRepositoryError("UNAVAILABLE");
}

function objectRow(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OwnerActivationRepositoryError("UNAVAILABLE");
  }
  return value as Record<string, unknown>;
}

function stringField(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new OwnerActivationRepositoryError("UNAVAILABLE");
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

export function createSupabaseOwnerActivationRepository(
  client: ServiceClient,
): OwnerActivationRepository {
  return {
    async complete(input): Promise<OwnerActivationCompletion> {
      const result = await client.rpc("complete_owner_activation", {
        p_input: {
          device_hash: input.deviceHash,
          plate_ciphertext: input.plate.ciphertext,
          plate_key_version: input.plate.keyVersion,
          plate_last4: input.plate.last4,
          plate_lookup_hash: input.plate.lookupHash,
          privacy_version: input.consent.privacyVersion,
          proof_hash: input.proofHash,
          public_token_hash: input.publicTokenHash,
          session_hash: input.sessionHash,
          session_ttl_seconds: input.sessionTtlSeconds,
          terms_version: input.consent.termsVersion,
        },
      });
      if (result.error?.message?.includes("ACTIVATION_UNAVAILABLE")) {
        throw new OwnerActivationRepositoryError("CONFLICT");
      }
      const row = resultData(result);
      if (row.qr_status !== "ACTIVE") {
        throw new OwnerActivationRepositoryError("UNAVAILABLE");
      }
      return {
        ownerId: stringField(row, "owner_id"),
        qrStatus: "ACTIVE",
        sessionExpiresAt: stringField(row, "session_expires_at"),
        vehicleId: stringField(row, "vehicle_id"),
        vehiclePlateLast4: stringField(row, "vehicle_plate_last4"),
      };
    },
    async inspect(input): Promise<OwnerActivationInspection> {
      const row = resultData(
        await client.rpc("inspect_owner_activation", {
          p_public_token_hash: input.publicTokenHash,
        }),
      );
      const assignmentMode = row.assignment_mode;
      const qrStatus = row.qr_status;
      if (
        (assignmentMode !== "PREASSIGNED" && assignmentMode !== "SELF_REGISTRATION") ||
        (qrStatus !== "IN_STOCK" && qrStatus !== "ASSIGNED" && qrStatus !== "ACTIVATION_PENDING") ||
        typeof row.activatable !== "boolean" ||
        (row.plate_last4 !== null && typeof row.plate_last4 !== "string")
      ) {
        throw new OwnerActivationRepositoryError("UNAVAILABLE");
      }
      return {
        activatable: row.activatable,
        assignmentMode,
        plateLast4: row.plate_last4,
        qrStatus,
        siteDisplayName: stringField(row, "site_display_name"),
      };
    },
    async listVehicles(input) {
      const result = await client.rpc("list_owner_vehicles", {
        p_device_hash: input.deviceHash,
        p_session_hash: input.sessionHash,
      });
      if (result.error) {
        throw mapError(result.error);
      }
      if (!Array.isArray(result.data)) {
        throw new OwnerActivationRepositoryError("UNAVAILABLE");
      }
      return result.data.map((value) => {
        const row = objectRow(value);
        if (row.qr_status !== "ACTIVE" && row.qr_status !== "SUSPENDED") {
          throw new OwnerActivationRepositoryError("UNAVAILABLE");
        }
        return {
          plateLast4: stringField(row, "plate_last4"),
          qrStatus: row.qr_status,
          siteId: stringField(row, "site_id"),
          vehicleId: stringField(row, "vehicle_id"),
        };
      });
    },
    async markOtpDelivery(input): Promise<void> {
      const result = await client.rpc("mark_owner_otp_delivery", {
        p_challenge_id: input.challengeId,
        p_status: input.status,
      });
      if (result.error) {
        throw mapError(result.error);
      }
    },
    async requestOtp(input): Promise<OwnerOtpRequestResult> {
      const row = resultData(
        await client.rpc("request_owner_activation_otp", {
          p_input: {
            attempt_limit: input.policy.attemptLimit,
            daily_phone_limit: input.policy.dailyPhoneLimit,
            device_hash: input.deviceHash,
            hourly_phone_limit: input.policy.hourlyPhoneLimit,
            network_hash: input.networkHash,
            network_window_limit: input.policy.networkWindowLimit,
            otp_hash: input.otpHash,
            phone_ciphertext: input.phone.ciphertext,
            phone_hash: input.phone.lookupHash,
            phone_key_version: input.phone.keyVersion,
            phone_last4: input.phone.last4,
            public_token_hash: input.publicTokenHash,
            resend_seconds: input.policy.resendSeconds,
            ttl_seconds: input.policy.ttlSeconds,
          },
        }),
      );
      return {
        challengeId: stringField(row, "challenge_id"),
        expiresAt: stringField(row, "expires_at"),
        resendAfter: stringField(row, "resend_after"),
      };
    },
    async requestReclaimOtp(input): Promise<OwnerOtpRequestResult> {
      const row = resultData(
        await client.rpc("request_owner_session_reclaim_otp", {
          p_input: {
            attempt_limit: input.policy.attemptLimit,
            daily_phone_limit: input.policy.dailyPhoneLimit,
            device_hash: input.deviceHash,
            hourly_phone_limit: input.policy.hourlyPhoneLimit,
            network_hash: input.networkHash,
            network_window_limit: input.policy.networkWindowLimit,
            otp_hash: input.otpHash,
            phone_ciphertext: input.phone.ciphertext,
            phone_hash: input.phone.lookupHash,
            phone_key_version: input.phone.keyVersion,
            phone_last4: input.phone.last4,
            plate_lookup_hash: input.plateLookupHash,
            public_token_hash: input.publicTokenHash,
            resend_seconds: input.policy.resendSeconds,
            ttl_seconds: input.policy.ttlSeconds,
          },
        }),
      );
      return {
        challengeId: stringField(row, "challenge_id"),
        expiresAt: stringField(row, "expires_at"),
        resendAfter: stringField(row, "resend_after"),
      };
    },
    async verifyReclaimOtp(input): Promise<OwnerReclaimVerificationResult> {
      const row = resultData(
        await client.rpc("verify_owner_session_reclaim_otp", {
          p_input: {
            challenge_id: input.challengeId,
            device_hash: input.deviceHash,
            otp_hash: input.otpHash,
            public_token_hash: input.publicTokenHash,
            session_hash: input.sessionHash,
            session_ttl_seconds: input.sessionTtlSeconds,
          },
        }),
      );
      if (row.reclaimed !== true) {
        throw new OwnerActivationRepositoryError(row.status === "LOCKED" ? "LIMITED" : "INVALID");
      }
      return {
        sessionExpiresAt: stringField(row, "session_expires_at"),
      };
    },
    async verifyOtp(input): Promise<OwnerOtpVerificationResult> {
      const row = resultData(
        await client.rpc("verify_owner_activation_otp", {
          p_input: {
            challenge_id: input.challengeId,
            otp_hash: input.otpHash,
            proof_hash: input.proofHash,
            proof_ttl_seconds: input.proofTtlSeconds,
            public_token_hash: input.publicTokenHash,
          },
        }),
      );
      if (row.verified !== true) {
        throw new OwnerActivationRepositoryError(row.status === "LOCKED" ? "LIMITED" : "INVALID");
      }
      return {
        expiresAt: stringField(row, "expires_at"),
        verified: true,
      };
    },
  };
}
