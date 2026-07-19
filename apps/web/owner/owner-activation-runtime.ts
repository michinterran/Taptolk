import "server-only";

import { OwnerActivationService } from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { createLogger } from "@taptolk/observability";
import { createAdminServiceClient } from "../auth/service-client";
import {
  AesGcmOwnerActivationProtector,
  RandomOwnerActivationSecretFactory,
} from "./owner-activation-crypto";
import {
  StagingMockOwnerOtpProvider,
  UnavailableOwnerOtpProvider,
} from "./owner-activation-provider";
import { createSupabaseOwnerActivationRepository } from "./supabase-owner-activation-repository";

const logger = createLogger({ service: "taptolk-web" });

export function createOwnerActivationService(): OwnerActivationService | null {
  let stage = "ENVIRONMENT";
  try {
    const environment = parseServerEnvironment();
    stage = "SERVICE_CLIENT";
    const client = createAdminServiceClient();
    if (!client || !environment.APP_ENCRYPTION_KEY_V1 || !environment.TOKEN_HMAC_KEY) {
      logger.error("owner_activation.runtime_unavailable", { stage });
      return null;
    }
    stage = "PROVIDER";
    const mockProvider =
      environment.APP_ENV !== "production" &&
      environment.SMS_PROVIDER === "mock" &&
      environment.OWNER_STAGING_MOCK_OTP;
    stage = "SERVICE";
    return new OwnerActivationService(
      createSupabaseOwnerActivationRepository(client),
      new AesGcmOwnerActivationProtector(
        environment.APP_ENCRYPTION_KEY_V1,
        environment.TOKEN_HMAC_KEY,
        environment.APP_ENCRYPTION_KEY_VERSION,
      ),
      new RandomOwnerActivationSecretFactory(mockProvider || undefined),
      mockProvider ? new StagingMockOwnerOtpProvider() : new UnavailableOwnerOtpProvider(),
      {
        attemptLimit: environment.OWNER_OTP_ATTEMPT_LIMIT,
        dailyPhoneLimit: environment.OWNER_OTP_DAILY_PHONE_LIMIT,
        hourlyPhoneLimit: environment.OWNER_OTP_HOURLY_PHONE_LIMIT,
        networkWindowLimit: environment.OWNER_OTP_NETWORK_WINDOW_LIMIT,
        proofTtlSeconds: environment.OWNER_OTP_PROOF_TTL_SECONDS,
        resendSeconds: environment.OWNER_OTP_RESEND_SECONDS,
        sessionTtlSeconds: environment.OWNER_SESSION_TTL_SECONDS,
        ttlSeconds: environment.OWNER_OTP_TTL_SECONDS,
      },
    );
  } catch {
    logger.error("owner_activation.runtime_unavailable", { stage });
    return null;
  }
}
