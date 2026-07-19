import "server-only";

import { PublicContactService } from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { createLogger } from "@taptolk/observability";
import { createAdminServiceClient } from "../auth/service-client";
import { HmacPublicContactHasher, RandomPublicContactSecretFactory } from "./public-contact-crypto";
import { createSupabasePublicContactRepository } from "./supabase-public-contact-repository";

const logger = createLogger({ service: "taptolk-web" });

export function createPublicContactService(): PublicContactService | null {
  let stage = "ENVIRONMENT";
  try {
    const environment = parseServerEnvironment();
    stage = "SERVICE_CLIENT";
    const client = createAdminServiceClient();
    if (!client || !environment.TOKEN_HMAC_KEY) {
      logger.error("public_contact.runtime_unavailable", { stage });
      return null;
    }
    stage = "SERVICE";
    return new PublicContactService(
      createSupabasePublicContactRepository(client),
      new HmacPublicContactHasher(environment.TOKEN_HMAC_KEY),
      new RandomPublicContactSecretFactory(),
      {
        anonymousGlobalLimit: environment.DEVICE_TOTAL_LIMIT_PER_10_MINUTES,
        anonymousGlobalWindowSeconds: 600,
        duplicateMergeSeconds: environment.QR_CALL_COOLDOWN_SECONDS,
        ipQrLimit: environment.IP_QR_LIMIT_PER_10_MINUTES,
        ipQrWindowSeconds: 600,
        qrGlobalLimit: environment.QR_GLOBAL_LIMIT_PER_MINUTE,
        qrGlobalWindowSeconds: 60,
        sessionTtlSeconds: environment.CONTACT_SESSION_TTL_MINUTES * 60,
      },
    );
  } catch {
    logger.error("public_contact.runtime_unavailable", { stage });
    return null;
  }
}
