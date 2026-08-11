import type { NotificationDispatchBatchResult } from "../notification-reply/notification-dispatch-runner";
import { isAuthorizedCronRequest } from "./cron-authorization";

export interface ScheduledNotificationDispatchConfiguration {
  cronSecret: string;
}

export interface ScheduledNotificationDispatchHandlerDependencies {
  readConfiguration(): ScheduledNotificationDispatchConfiguration | null;
  run(requestId: string): Promise<NotificationDispatchBatchResult>;
}

export async function handleScheduledNotificationDispatchRequest(
  input: {
    authorizationHeader: string | null;
    requestId: string;
  },
  dependencies: ScheduledNotificationDispatchHandlerDependencies,
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
        data: await dependencies.run(input.requestId),
        meta: { requestId: input.requestId },
      },
      status: 200,
    };
  } catch {
    return {
      body: {
        error: { code: "DISPATCH_FAILED", retryable: true },
        meta: { requestId: input.requestId },
      },
      status: 500,
    };
  }
}
