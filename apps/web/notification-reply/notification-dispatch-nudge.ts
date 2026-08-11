import "server-only";

import { randomUUID } from "node:crypto";
import { APP_IDENTITY } from "@taptolk/config";
import { createLogger, type StructuredLogger } from "@taptolk/observability";
import { after } from "next/server";
import {
  type NotificationDispatchBatchResult,
  runNotificationDispatchBatch,
} from "./notification-dispatch-runner";

export type NotificationDispatchNudgeReason = "CONTACT_CREATED" | "OFFICE_ALERT_QUEUED";

export interface NotificationDispatchNudgeDependencies {
  logger: Pick<StructuredLogger, "info" | "warn">;
  run(input: { workerId: string }): Promise<NotificationDispatchBatchResult>;
  schedule(callback: () => Promise<void>): void;
}

const defaultDependencies: NotificationDispatchNudgeDependencies = {
  logger: createLogger({ service: APP_IDENTITY.serviceNames.web }),
  run: runNotificationDispatchBatch,
  schedule: after,
};

export function scheduleNotificationDispatchNudge(
  reason: NotificationDispatchNudgeReason,
  dependencies: NotificationDispatchNudgeDependencies = defaultDependencies,
): void {
  const workerId = `nudge-${randomUUID()}`;
  try {
    dependencies.schedule(async () => {
      try {
        const result = await dependencies.run({ workerId });
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
      }
    });
  } catch {
    dependencies.logger.warn("notification_dispatch.nudge_schedule_failed", {
      errorCode: "SCHEDULE_FAILED",
      reason,
    });
  }
}
