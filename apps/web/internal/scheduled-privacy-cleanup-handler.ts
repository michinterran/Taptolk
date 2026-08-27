import type { ScheduledPrivacyCleanupResult } from "@taptolk/application";
import { isAuthorizedCronRequest } from "./cron-authorization";
import type { ScheduledPrivacyCleanupConfiguration } from "./privacy-cleanup-runtime";

export interface ScheduledPrivacyCleanupHandlerDependencies {
  readConfiguration(): ScheduledPrivacyCleanupConfiguration | null;
  run(configuration: ScheduledPrivacyCleanupConfiguration): Promise<ScheduledPrivacyCleanupResult>;
}

export async function handleScheduledPrivacyCleanupRequest(
  input: {
    authorizationHeader: string | null;
    requestId: string;
  },
  dependencies: ScheduledPrivacyCleanupHandlerDependencies,
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
    const data = await dependencies.run(configuration);
    if (data.status === "PARTIAL_FAILURE") {
      return {
        body: {
          data,
          error: { code: "PARTIAL_FAILURE", retryable: true },
          meta: { requestId: input.requestId },
        },
        status: 500,
      };
    }
    return {
      body: {
        data,
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
