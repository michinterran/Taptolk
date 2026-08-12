import "server-only";

import {
  createNotificationDispatchService,
  createWebPushNotificationDispatchService,
} from "./notification-reply-runtime";

export const NOTIFICATION_DISPATCH_POLICY = Object.freeze({
  leaseSeconds: 30,
  limit: 10,
});

export type NotificationDispatchChannel = "SMS" | "WEB_PUSH";

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
  channels?: readonly NotificationDispatchChannel[];
  workerId: string;
}): Promise<NotificationDispatchBatchResult> {
  const channels = input.channels ?? ["SMS", "WEB_PUSH"];
  const runSms = channels.includes("SMS");
  const runWebPush = channels.includes("WEB_PUSH");
  const result = runSms
    ? await runSmsDispatch(input.workerId)
    : { claimed: 0, failedFinal: 0, retryScheduled: 0, sent: 0 };
  const webPush = runWebPush
    ? await runWebPushDispatch(input.workerId)
    : { skipped: true as const };
  return { ...result, webPush };
}

async function runSmsDispatch(workerId: string) {
  const service = createNotificationDispatchService();
  if (!service) {
    throw new NotificationDispatchUnavailableError();
  }
  return service.run({
    ...NOTIFICATION_DISPATCH_POLICY,
    workerId,
  });
}

async function runWebPushDispatch(workerId: string) {
  const webPushService = createWebPushNotificationDispatchService();
  return webPushService
    ? webPushService.run({
        ...NOTIFICATION_DISPATCH_POLICY,
        workerId: `wp-${workerId}`,
      })
    : { skipped: true as const };
}
