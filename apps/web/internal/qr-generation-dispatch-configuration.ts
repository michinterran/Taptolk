import type { QrGenerationDispatchRuntimePolicy } from "@taptolk/application";
import type { ServerEnvironment } from "@taptolk/config";

export interface StagingQrGenerationDispatchConfiguration {
  cronSecret: string;
  publisher: {
    queueName: string;
    requestTimeoutMs: number;
  };
  retry: {
    baseDelayMs: number;
    jitterRatio: number;
    maxDelayMs: number;
  };
  runtime: QrGenerationDispatchRuntimePolicy;
}

export function buildStagingQrGenerationDispatchConfiguration(
  environment: ServerEnvironment,
): StagingQrGenerationDispatchConfiguration | null {
  if (
    environment.APP_ENV !== "staging" ||
    !environment.CRON_SECRET ||
    !environment.SUPABASE_SECRET_KEY
  ) {
    return null;
  }

  return {
    cronSecret: environment.CRON_SECRET,
    publisher: {
      queueName: environment.QR_GENERATION_QUEUE_NAME,
      requestTimeoutMs: environment.QR_GENERATION_QUEUE_SEND_TIMEOUT_MS,
    },
    retry: {
      baseDelayMs: environment.QR_GENERATION_DELIVERY_RETRY_BASE_DELAY_MS,
      jitterRatio: environment.QR_GENERATION_DELIVERY_RETRY_JITTER_RATIO,
      maxDelayMs: environment.QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS,
    },
    runtime: {
      claimLimit: environment.QR_GENERATION_DISPATCH_CLAIM_LIMIT,
      durationBudgetMs: environment.QR_GENERATION_DISPATCH_DURATION_BUDGET_MS,
      leaseSeconds: environment.QR_GENERATION_DISPATCH_LEASE_SECONDS,
    },
  };
}
