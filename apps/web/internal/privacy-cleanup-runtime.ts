import "server-only";

import {
  type PrivacyCleanupResult,
  PrivacyCleanupService,
  type ScheduledPrivacyCleanupResult,
  ScheduledPrivacyCleanupService,
} from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { createAdminServiceClient } from "../auth/service-client";
import { createSupabasePrivacyCleanupRepository } from "./supabase-privacy-cleanup-repository";
import { createSupabaseScheduledPrivacyCleanupRepository } from "./supabase-scheduled-privacy-cleanup-repository";

export interface PrivacyCleanupConfiguration {
  blockGraceHours: number;
  cronSecret: string;
  messageRetentionHours: number;
  tokenGraceHours: number;
}

export interface ScheduledPrivacyCleanupConfiguration extends PrivacyCleanupConfiguration {
  durationBudgetMs: number;
  tenantLimit: number;
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

export function readScheduledPrivacyCleanupConfiguration(): ScheduledPrivacyCleanupConfiguration | null {
  try {
    const environment = parseServerEnvironment();
    if (!environment.CRON_SECRET || !environment.SUPABASE_SECRET_KEY) {
      return null;
    }
    return {
      blockGraceHours: environment.BLOCK_REVOCATION_GRACE_HOURS,
      cronSecret: environment.CRON_SECRET,
      durationBudgetMs: environment.PRIVACY_CLEANUP_DURATION_BUDGET_MS,
      messageRetentionHours: environment.MESSAGE_RETENTION_HOURS,
      tenantLimit: environment.PRIVACY_CLEANUP_TENANT_LIMIT,
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

export async function runScheduledPrivacyCleanup(
  configuration: ScheduledPrivacyCleanupConfiguration,
): Promise<ScheduledPrivacyCleanupResult> {
  const client = createAdminServiceClient();
  if (!client) {
    throw new Error("SCHEDULED_PRIVACY_CLEANUP_UNAVAILABLE");
  }
  return new ScheduledPrivacyCleanupService(
    createSupabaseScheduledPrivacyCleanupRepository(client),
  ).run({
    blockGraceHours: configuration.blockGraceHours,
    durationBudgetMs: configuration.durationBudgetMs,
    messageRetentionHours: configuration.messageRetentionHours,
    tenantLimit: configuration.tenantLimit,
    tokenGraceHours: configuration.tokenGraceHours,
  });
}
