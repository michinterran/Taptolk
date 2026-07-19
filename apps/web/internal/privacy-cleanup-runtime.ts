import "server-only";

import { type PrivacyCleanupResult, PrivacyCleanupService } from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { createAdminServiceClient } from "../auth/service-client";
import { createSupabasePrivacyCleanupRepository } from "./supabase-privacy-cleanup-repository";

export interface PrivacyCleanupConfiguration {
  blockGraceHours: number;
  cronSecret: string;
  messageRetentionHours: number;
  tokenGraceHours: number;
}

export function readPrivacyCleanupConfiguration(): PrivacyCleanupConfiguration | null {
  try {
    const environment = parseServerEnvironment();
    if (!environment.CRON_SECRET || !environment.SUPABASE_SECRET_KEY) {
      return null;
    }
    return {
      blockGraceHours: environment.BLOCK_REVOCATION_GRACE_HOURS,
      cronSecret: environment.CRON_SECRET,
      messageRetentionHours: environment.MESSAGE_RETENTION_HOURS,
      tokenGraceHours: environment.TOKEN_REVOCATION_GRACE_HOURS,
    };
  } catch {
    return null;
  }
}

export async function runPrivacyCleanup(
  configuration: PrivacyCleanupConfiguration,
  input: { requestId: string; tenantId: string },
): Promise<PrivacyCleanupResult> {
  const client = createAdminServiceClient();
  if (!client) {
    throw new Error("PRIVACY_CLEANUP_UNAVAILABLE");
  }
  return new PrivacyCleanupService(createSupabasePrivacyCleanupRepository(client)).run({
    blockGraceHours: configuration.blockGraceHours,
    messageRetentionHours: configuration.messageRetentionHours,
    requestId: input.requestId,
    tenantId: input.tenantId,
    tokenGraceHours: configuration.tokenGraceHours,
  });
}
