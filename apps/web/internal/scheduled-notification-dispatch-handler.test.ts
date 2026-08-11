import { describe, expect, it, vi } from "vitest";
import {
  handleScheduledNotificationDispatchRequest,
  type ScheduledNotificationDispatchHandlerDependencies,
} from "./scheduled-notification-dispatch-handler";

const CRON_SECRET = "scheduled-notification-secret-value-123456789";
const requestId = "11111111-1111-4111-8111-111111111111";

function dependencies(): ScheduledNotificationDispatchHandlerDependencies {
  return {
    readConfiguration: vi.fn(() => ({ cronSecret: CRON_SECRET })),
    run: vi.fn(async () => ({
      claimed: 1,
      failedFinal: 0,
      retryScheduled: 0,
      sent: 1,
      webPush: { claimed: 1, failedFinal: 0, retryScheduled: 0, sent: 1 },
    })),
  };
}

describe("scheduled notification dispatch HTTP policy", () => {
  it("fails closed when scheduled configuration is unavailable", async () => {
    const target = dependencies();
    vi.mocked(target.readConfiguration).mockReturnValue(null);
    const result = await handleScheduledNotificationDispatchRequest(
      { authorizationHeader: `Bearer ${CRON_SECRET}`, requestId },
      target,
    );
    expect(result.status).toBe(503);
    expect(target.run).not.toHaveBeenCalled();
  });

  it("rejects an invalid Cron bearer before dispatch", async () => {
    const target = dependencies();
    const result = await handleScheduledNotificationDispatchRequest(
      { authorizationHeader: "Bearer invalid-value-long-enough-123", requestId },
      target,
    );
    expect(result.status).toBe(401);
    expect(target.run).not.toHaveBeenCalled();
  });

  it("returns aggregate dispatch evidence without the secret", async () => {
    const result = await handleScheduledNotificationDispatchRequest(
      { authorizationHeader: `Bearer ${CRON_SECRET}`, requestId },
      dependencies(),
    );
    expect(result).toMatchObject({ body: { data: { claimed: 1, sent: 1 } }, status: 200 });
    expect(JSON.stringify(result)).not.toContain(CRON_SECRET);
  });

  it("reduces runtime failure without upstream detail", async () => {
    const target = dependencies();
    vi.mocked(target.run).mockRejectedValue(new Error("provider detail"));
    const result = await handleScheduledNotificationDispatchRequest(
      { authorizationHeader: `Bearer ${CRON_SECRET}`, requestId },
      target,
    );
    expect(result.status).toBe(500);
    expect(JSON.stringify(result)).not.toContain("provider detail");
  });
});
