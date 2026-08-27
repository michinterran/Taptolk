import { describe, expect, it } from "vitest";
import {
  assertOperationsWorkQueueMutation,
  type OperationsWorkQueueMutation,
  type OperationsWorkQueueRepository,
  OperationsWorkQueueService,
} from "./operations-work-queue-contract.js";

const validMutation: OperationsWorkQueueMutation = {
  expectedVersion: 1,
  itemId: "22222222-2222-4222-8222-222222222222",
  kind: "ESCALATION",
  reason: "담당 업무를 확인했습니다.",
  requestId: "33333333-3333-4333-8333-333333333333",
  type: "ACKNOWLEDGE",
};

const authorization = {
  mfaVerified: true,
  role: "SITE_ADMIN" as const,
  scope: {
    managementCompanyId: "66666666-6666-4666-8666-666666666666",
    siteId: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    type: "SITE" as const,
  },
};

describe("Operations work queue contract", () => {
  it("requires a reason, request id, and optimistic version", () => {
    expect(() => assertOperationsWorkQueueMutation(validMutation)).not.toThrow();
    expect(() => assertOperationsWorkQueueMutation({ ...validMutation, reason: "no" })).toThrow(
      "INVALID_OPERATIONS_WORK_QUEUE_MUTATION",
    );
    expect(() =>
      assertOperationsWorkQueueMutation({ ...validMutation, expectedVersion: 0 }),
    ).toThrow("INVALID_OPERATIONS_WORK_QUEUE_MUTATION");
  });

  it("requires a scoped membership id for assignment", () => {
    expect(() =>
      assertOperationsWorkQueueMutation({
        ...validMutation,
        type: "ASSIGN",
        assigneeMembershipId: "not-an-id",
      }),
    ).toThrow("INVALID_OPERATIONS_WORK_QUEUE_ASSIGNEE");
  });

  it("does not permit priority, assignee, or SLA values without persisted data", () => {
    const item = {
      actions: [],
      assigneeDisplayName: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      elapsedSeconds: 60,
      id: "44444444-4444-4444-8444-444444444444",
      kind: "ESCALATION" as const,
      queueState: "WAITING" as const,
      lastAttemptAt: null,
      managementCompanyName: "관리회사",
      priority: null,
      siteId: "22222222-2222-4222-8222-222222222222",
      siteName: "사이트",
      source: "CONTACT_SESSIONS" as const,
      sourceStatus: "ESCALATED",
      sourceVersion: null,
      version: 1,
      sla: null,
    };

    expect(item.assigneeDisplayName).toBeNull();
    expect(item.priority).toBeNull();
    expect(item.sla).toBeNull();
  });

  it("authorizes the scoped read before repository access", async () => {
    const repository: OperationsWorkQueueRepository = {
      mutate: async () => ({ asOf: "", hasMore: false, items: [], nextCursor: null }),
      read: async () => ({ asOf: "", hasMore: false, items: [], nextCursor: null }),
    };
    await new OperationsWorkQueueService(repository).read({
      actor: {
        authorization,
        userId: "33333333-3333-4333-8333-333333333333",
      },
      scope: { siteId: authorization.scope.siteId },
    });
  });

  it("authorizes mutation with the dedicated operations permission", async () => {
    let called = false;
    const repository: OperationsWorkQueueRepository = {
      mutate: async () => {
        called = true;
        return { asOf: "", hasMore: false, items: [], nextCursor: null };
      },
      read: async () => ({ asOf: "", hasMore: false, items: [], nextCursor: null }),
    };
    await new OperationsWorkQueueService(repository).mutate({
      actor: {
        authorization,
        userId: "33333333-3333-4333-8333-333333333333",
      },
      mutation: validMutation,
      scope: { siteId: authorization.scope.siteId },
    });
    expect(called).toBe(true);
  });
});
