import "server-only";

import { randomUUID } from "node:crypto";
import { APP_IDENTITY } from "@taptolk/config";
import { createLogger, type StructuredLogger } from "@taptolk/observability";
import { after } from "next/server";
import {
  type NotificationDispatchBatchResult,
  type NotificationDispatchChannel,
  runNotificationDispatchBatch,
} from "./notification-dispatch-runner";

export type NotificationDispatchNudgeReason = "CONTACT_CREATED" | "OFFICE_ALERT_QUEUED";

export interface NotificationDispatchNudgeDependencies {
  logger: Pick<StructuredLogger, "info" | "warn">;
  run(input: {
    channel: NotificationDispatchChannel;
    workerId: string;
  }): Promise<NotificationDispatchBatchResult>;
  schedule(callback: () => Promise<void>): void;
}

const defaultDependencies: NotificationDispatchNudgeDependencies = {
  logger: createLogger({ service: APP_IDENTITY.serviceNames.web }),
  run: runNotificationDispatchBatch,
  schedule: after,
};

const pendingChannels = new Set<NotificationDispatchChannel>();

function channelFor(reason: NotificationDispatchNudgeReason): NotificationDispatchChannel {
  return reason === "CONTACT_CREATED" ? "SMS" : "WEB_PUSH";
}

export function scheduleNotificationDispatchNudge(
  reason: NotificationDispatchNudgeReason,
  dependencies: NotificationDispatchNudgeDependencies = defaultDependencies,
): void {
  const channel = channelFor(reason);
  if (pendingChannels.has(channel)) {
    return;
  }
  pendingChannels.add(channel);
  const workerId = `nudge-${randomUUID()}`;
  try {
    dependencies.schedule(async () => {
      try {
        const result = await dependencies.run({ channel, workerId });
        dependencies.logger.info("notification_dispatch.nudge_completed", {
          claimedCount: result.claimed,
          reason,
          sentCount: result.sent,
          webPushClaimedCount: "skipped" in result.webPush ? 0 : result.webPush.claimed,
          webPushSentCount: "skipped" in result.webPush ? 0 : result.webPush.sent,
        });
      } catch {
        dependencies.logger.warn("notification_dispatch.nudge_failed", {
          errorCode: "DISPATCH_FAILED",
          reason,
        });
      } finally {
        pendingChannels.delete(channel);
      }
    });
  } catch {
    pendingChannels.delete(channel);
    dependencies.logger.warn("notification_dispatch.nudge_schedule_failed", {
      errorCode: "SCHEDULE_FAILED",
      reason,
    });
  }
}
