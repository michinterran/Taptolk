import "server-only";

import {
  createNotificationDispatchService,
  createWebPushNotificationDispatchService,
} from "./notification-reply-runtime";

export const NOTIFICATION_DISPATCH_POLICY = Object.freeze({
  leaseSeconds: 30,
  limit: 10,
});

export type NotificationDispatchBatchResult = {
  claimed: number;
  failedFinal: number;
  retryScheduled: number;
  sent: number;
  webPush:
    | {
        claimed: number;
        failedFinal: number;
        retryScheduled: number;
        sent: number;
      }
    | { skipped: true };
};

export class NotificationDispatchUnavailableError extends Error {
  constructor() {
    super("Notification dispatch is unavailable.");
    this.name = "NotificationDispatchUnavailableError";
  }
}

export async function runNotificationDispatchBatch(input: {
  workerId: string;
}): Promise<NotificationDispatchBatchResult> {
  const service = createNotificationDispatchService();
  if (!service) {
    throw new NotificationDispatchUnavailableError();
  }
  const result = await service.run({
    ...NOTIFICATION_DISPATCH_POLICY,
    workerId: input.workerId,
  });
  const webPushService = createWebPushNotificationDispatchService();
  const webPush = webPushService
    ? await webPushService.run({
        ...NOTIFICATION_DISPATCH_POLICY,
        workerId: `wp-${input.workerId}`,
      })
    : { skipped: true as const };
  return { ...result, webPush };
}
