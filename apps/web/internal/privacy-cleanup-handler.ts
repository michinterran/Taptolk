import type { PrivacyCleanupResult } from "@taptolk/application";
import { isAuthorizedCronRequest } from "./cron-authorization";
import type { PrivacyCleanupConfiguration } from "./privacy-cleanup-runtime";

export interface PrivacyCleanupHandlerDependencies {
  readConfiguration(): PrivacyCleanupConfiguration | null;
  run(
    configuration: PrivacyCleanupConfiguration,
    input: { requestId: string; tenantId: string },
  ): Promise<PrivacyCleanupResult>;
}

export async function handlePrivacyCleanupRequest(
  input: {
    authorizationHeader: string | null;
    requestId: string;
    tenantId: string;
  },
  dependencies: PrivacyCleanupHandlerDependencies,
): Promise<{
  body: Readonly<Record<string, unknown>>;
  status: 200 | 401 | 500 | 503;
}> {
  const configuration = dependencies.readConfiguration();
  if (!configuration) {
    return {
      body: {
        error: { code: "UNAVAILABLE", retryable: false },
        meta: { requestId: input.requestId },
      },
      status: 503,
    };
  }
  if (!isAuthorizedCronRequest(input.authorizationHeader, configuration.cronSecret)) {
    return {
      body: {
        error: { code: "UNAUTHORIZED", retryable: false },
        meta: { requestId: input.requestId },
      },
      status: 401,
    };
  }
  try {
    return {
      body: {
        data: await dependencies.run(configuration, {
          requestId: input.requestId,
          tenantId: input.tenantId,
        }),
        meta: { requestId: input.requestId },
      },
      status: 200,
    };
  } catch {
    return {
      body: {
        error: { code: "CLEANUP_FAILED", retryable: true },
        meta: { requestId: input.requestId },
      },
      status: 500,
    };
  }
}
