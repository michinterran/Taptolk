import { describe, expect, it, vi } from "vitest";
import {
  type NotificationDispatchNudgeDependencies,
  scheduleNotificationDispatchNudge,
} from "./notification-dispatch-nudge";

vi.mock("server-only", () => ({}));

function dependencies(): {
  callbacks: Array<() => Promise<void>>;
  target: NotificationDispatchNudgeDependencies;
} {
  const callbacks: Array<() => Promise<void>> = [];
  return {
    callbacks,
    target: {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      run: vi.fn(async () => ({
        claimed: 1,
        failedFinal: 0,
        retryScheduled: 0,
        sent: 1,
        webPush: { skipped: true as const },
      })),
      schedule: vi.fn((callback) => callbacks.push(callback)),
    },
  };
}

describe("notification dispatch nudge", () => {
  it("runs after the response lifecycle and records aggregate evidence", async () => {
    const { callbacks, target } = dependencies();
    scheduleNotificationDispatchNudge("CONTACT_CREATED", target);
    expect(target.run).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);

    await callbacks[0]?.();

    expect(target.run).toHaveBeenCalledWith({
      channel: "SMS",
      workerId: expect.stringMatching(/^nudge-/u),
    });
    expect(target.logger.info).toHaveBeenCalledWith(
      "notification_dispatch.nudge_completed",
      expect.objectContaining({ claimedCount: 1, reason: "CONTACT_CREATED", sentCount: 1 }),
    );
  });

  it("does not reject the contact response when deferred dispatch fails", async () => {
    const { callbacks, target } = dependencies();
    vi.mocked(target.run).mockRejectedValue(new Error("provider detail must not escape"));
    expect(() => scheduleNotificationDispatchNudge("CONTACT_CREATED", target)).not.toThrow();

    await expect(callbacks[0]?.()).resolves.toBeUndefined();
    expect(target.logger.warn).toHaveBeenCalledWith("notification_dispatch.nudge_failed", {
      errorCode: "DISPATCH_FAILED",
      reason: "CONTACT_CREATED",
    });
  });

  it("does not reject the contact response when scheduling is unavailable", () => {
    const { target } = dependencies();
    vi.mocked(target.schedule).mockImplementation(() => {
      throw new Error("request lifecycle unavailable");
    });

    expect(() => scheduleNotificationDispatchNudge("OFFICE_ALERT_QUEUED", target)).not.toThrow();
    expect(target.run).not.toHaveBeenCalled();
    expect(target.logger.warn).toHaveBeenCalledWith("notification_dispatch.nudge_schedule_failed", {
      errorCode: "SCHEDULE_FAILED",
      reason: "OFFICE_ALERT_QUEUED",
    });
  });

  it("coalesces duplicate nudges for the same channel until the scheduled work finishes", async () => {
    const { callbacks, target } = dependencies();
    scheduleNotificationDispatchNudge("CONTACT_CREATED", target);
    scheduleNotificationDispatchNudge("CONTACT_CREATED", target);

    expect(callbacks).toHaveLength(1);
    await callbacks[0]?.();
    expect(target.run).toHaveBeenCalledOnce();
  });

  it("keeps SMS and Web Push nudges independent", async () => {
    const sms = dependencies();
    const webPush = dependencies();
    scheduleNotificationDispatchNudge("CONTACT_CREATED", sms.target);
    scheduleNotificationDispatchNudge("OFFICE_ALERT_QUEUED", webPush.target);

    expect(sms.callbacks).toHaveLength(1);
    expect(webPush.callbacks).toHaveLength(1);
    await sms.callbacks[0]?.();
    await webPush.callbacks[0]?.();
  });
});
