import type { AdminAuthorizationContext } from "@taptolk/domain";
import { describe, expect, it, vi } from "vitest";
import {
  QR_GENERATION_MAX_EXECUTION_ATTEMPTS,
  type QrFinalApprovalBatchItem,
  QrFinalGenerationApprovalError,
  type QrFinalGenerationApprovalRepository,
  QrFinalGenerationApprovalService,
} from "./qr-final-generation-approval-service.js";

const IDS = {
  actor: "00000000-0000-4000-8000-000000000001",
  batch: "00000000-0000-4000-8000-000000000002",
  company: "00000000-0000-4000-8000-000000000003",
  other: "00000000-0000-4000-8000-000000000004",
  request: "00000000-0000-4000-8000-000000000005",
  site: "00000000-0000-4000-8000-000000000006",
  tenant: "00000000-0000-4000-8000-000000000007",
} as const;

function actor(
  role: AdminAuthorizationContext["role"],
  options: { mfaVerified?: boolean; userId?: string } = {},
) {
  const scope =
    role === "SUPER_ADMIN" || role === "PLATFORM_OPERATOR"
      ? { type: "PLATFORM" as const }
      : role === "MANAGEMENT_ADMIN"
        ? {
            managementCompanyId: IDS.company,
            tenantId: IDS.tenant,
            type: "MANAGEMENT_COMPANY" as const,
          }
        : {
            managementCompanyId: IDS.company,
            siteId: IDS.site,
            tenantId: IDS.tenant,
            type: "SITE" as const,
          };

  return {
    authorization: {
      mfaVerified: options.mfaVerified ?? true,
      role,
      scope,
    },
    userId: options.userId ?? IDS.actor,
  };
}

function batch(overrides: Partial<QrFinalApprovalBatchItem> = {}): QrFinalApprovalBatchItem {
  return {
    batchCode: "QR-2026-0001",
    createdAt: "2026-07-19T00:00:00.000Z",
    hasGenerationJob: false,
    id: IDS.batch,
    managementCompanyId: IDS.company,
    managementCompanyStatus: "ACTIVE",
    requestedByCurrentActor: true,
    requestedQuantity: 20,
    sampleStatus: "APPROVED",
    siteId: IDS.site,
    siteName: "Site",
    siteStatus: "ACTIVE",
    status: "SAMPLE_APPROVED",
    stickerDesignStatus: "APPROVED",
    tenantId: IDS.tenant,
    tenantStatus: "ACTIVE",
    version: 3,
    ...overrides,
  };
}

function repository(
  options: {
    commandBatch?: QrFinalApprovalBatchItem | null;
    list?: readonly QrFinalApprovalBatchItem[];
  } = {},
): QrFinalGenerationApprovalRepository {
  return {
    approveFinalGeneration: vi.fn().mockResolvedValue({
      batchId: IDS.batch,
      batchStatus: "GENERATION_APPROVED",
      batchVersion: 5,
      generationRevision: 1,
      jobStatus: "PENDING_DELIVERY",
    }),
    cancelBeforeGenerationApproval: vi.fn().mockResolvedValue({
      batchId: IDS.batch,
      batchStatus: "CANCELLED",
      batchVersion: 5,
      generationRevision: null,
      jobStatus: null,
    }),
    getBatchForCommand: vi
      .fn()
      .mockResolvedValue("commandBatch" in options ? (options.commandBatch ?? null) : batch()),
    list: vi.fn().mockResolvedValue(options.list ?? []),
    requestFinalApproval: vi.fn().mockResolvedValue({
      batchId: IDS.batch,
      batchStatus: "FINAL_APPROVAL_PENDING",
      batchVersion: 4,
      generationRevision: null,
      jobStatus: null,
    }),
  };
}

const command = {
  batchId: IDS.batch,
  expectedBatchVersion: 3,
  reason: "Ready for review",
  requestId: IDS.request,
} as const;

describe("QrFinalGenerationApprovalService", () => {
  it("freezes the reviewed generation execution attempt limit", () => {
    expect(QR_GENERATION_MAX_EXECUTION_ATTEMPTS).toBe(5);
  });

  it("derives requester actions and an independent Super Admin queue", async () => {
    const ownApproved = batch();
    const otherPending = batch({
      id: IDS.other,
      requestedByCurrentActor: false,
      status: "FINAL_APPROVAL_PENDING",
    });
    const ownPending = batch({
      id: IDS.request,
      requestedByCurrentActor: true,
      status: "FINAL_APPROVAL_PENDING",
    });

    const requesterModel = await new QrFinalGenerationApprovalService(
      repository({ list: [ownApproved, otherPending] }),
    ).list({ actor: actor("MANAGEMENT_ADMIN") });
    const superModel = await new QrFinalGenerationApprovalService(
      repository({ list: [ownApproved, otherPending, ownPending] }),
    ).list({ actor: actor("SUPER_ADMIN") });

    expect(requesterModel.requestableBatchIds.has(IDS.batch)).toBe(true);
    expect(requesterModel.cancellableBatchIds.has(IDS.batch)).toBe(true);
    expect(requesterModel.finalApprovalQueue).toEqual([]);
    expect(superModel.finalApprovalQueue).toEqual([otherPending]);
    expect(superModel.finalApprovalQueue).not.toContain(ownPending);
  });

  it("keeps read-only actors out of mutation sets", async () => {
    const model = await new QrFinalGenerationApprovalService(repository({ list: [batch()] })).list({
      actor: actor("READ_ONLY"),
    });

    expect(model.requestableBatchIds.size).toBe(0);
    expect(model.cancellableBatchIds.size).toBe(0);
    expect(model.finalApprovalQueue).toEqual([]);
  });

  it("loads the authoritative Batch and normalizes the requester command", async () => {
    const repo = repository();

    await new QrFinalGenerationApprovalService(repo).requestFinalApproval({
      actor: actor("MANAGEMENT_ADMIN"),
      ...command,
      reason: "  Ready for platform review  ",
    });

    expect(repo.getBatchForCommand).toHaveBeenCalledWith(IDS.batch);
    expect(repo.requestFinalApproval).toHaveBeenCalledWith({
      batchId: IDS.batch,
      expectedBatchVersion: 3,
      reason: "Ready for platform review",
      requestId: IDS.request,
    });
  });

  it("requires the original requester and an approved sample/design", async () => {
    await expect(
      new QrFinalGenerationApprovalService(
        repository({ commandBatch: batch({ requestedByCurrentActor: false }) }),
      ).requestFinalApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("REQUESTER_REQUIRED"));
    await expect(
      new QrFinalGenerationApprovalService(
        repository({ commandBatch: batch({ sampleStatus: "INVALIDATED" }) }),
      ).requestFinalApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("INVALID_SAMPLE_STATUS"));
    await expect(
      new QrFinalGenerationApprovalService(
        repository({ commandBatch: batch({ stickerDesignStatus: "ARCHIVED" }) }),
      ).requestFinalApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("INVALID_DESIGN_STATUS"));
  });

  it("requires active Tenant, company, and Site parents", async () => {
    const service = new QrFinalGenerationApprovalService(
      repository({ commandBatch: batch({ siteStatus: "SUSPENDED" }) }),
    );

    await expect(
      service.requestFinalApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("INACTIVE_PARENT"));
  });

  it("requires MFA before reading a customer command target", async () => {
    const repo = repository();

    await expect(
      new QrFinalGenerationApprovalService(repo).requestFinalApproval({
        actor: actor("MANAGEMENT_ADMIN", { mfaVerified: false }),
        ...command,
      }),
    ).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    expect(repo.getBatchForCommand).not.toHaveBeenCalled();
  });

  it("allows only an independent AAL2 Super Admin to approve generation", async () => {
    const approvalBatch = batch({
      requestedByCurrentActor: false,
      status: "FINAL_APPROVAL_PENDING",
      version: 4,
    });
    const approvalCommand = { ...command, expectedBatchVersion: 4 };
    const roleRepo = repository({ commandBatch: approvalBatch });

    await expect(
      new QrFinalGenerationApprovalService(roleRepo).approveFinalGeneration({
        actor: actor("PLATFORM_OPERATOR"),
        ...approvalCommand,
      }),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
    expect(roleRepo.getBatchForCommand).not.toHaveBeenCalled();

    const mfaRepo = repository({ commandBatch: approvalBatch });
    await expect(
      new QrFinalGenerationApprovalService(mfaRepo).approveFinalGeneration({
        actor: actor("SUPER_ADMIN", { mfaVerified: false }),
        ...approvalCommand,
      }),
    ).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    expect(mfaRepo.getBatchForCommand).not.toHaveBeenCalled();

    await expect(
      new QrFinalGenerationApprovalService(
        repository({
          commandBatch: batch({ status: "FINAL_APPROVAL_PENDING", version: 4 }),
        }),
      ).approveFinalGeneration({
        actor: actor("SUPER_ADMIN"),
        ...approvalCommand,
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("SELF_APPROVAL_FORBIDDEN"));
  });

  it("returns only the safe durable handoff result from final approval", async () => {
    const repo = repository({
      commandBatch: batch({
        requestedByCurrentActor: false,
        status: "FINAL_APPROVAL_PENDING",
        version: 4,
      }),
    });
    const result = await new QrFinalGenerationApprovalService(repo).approveFinalGeneration({
      actor: actor("SUPER_ADMIN"),
      ...command,
      expectedBatchVersion: 4,
      reason: "  Final controls passed  ",
    });

    expect(repo.approveFinalGeneration).toHaveBeenCalledWith({
      batchId: IDS.batch,
      expectedBatchVersion: 4,
      reason: "Final controls passed",
      requestId: IDS.request,
    });
    expect(result).toEqual({
      batchId: IDS.batch,
      batchStatus: "GENERATION_APPROVED",
      batchVersion: 5,
      generationRevision: 1,
      jobStatus: "PENDING_DELIVERY",
    });
    expect(result).not.toHaveProperty("jobId");
    expect(result).not.toHaveProperty("queueMessageId");
  });

  it("allows requester cancellation only before a durable generation job exists", async () => {
    const repo = repository({
      commandBatch: batch({ status: "FINAL_APPROVAL_PENDING" }),
    });

    await new QrFinalGenerationApprovalService(repo).cancelBeforeGenerationApproval({
      actor: actor("MANAGEMENT_ADMIN"),
      ...command,
      reason: "  Quantity no longer required  ",
    });

    expect(repo.cancelBeforeGenerationApproval).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Quantity no longer required" }),
    );
    await expect(
      new QrFinalGenerationApprovalService(
        repository({
          commandBatch: batch({
            hasGenerationJob: true,
            status: "FINAL_APPROVAL_PENDING",
          }),
        }),
      ).cancelBeforeGenerationApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("GENERATION_JOB_EXISTS"));
  });

  it("rejects cancellation after generation approval or by another actor", async () => {
    await expect(
      new QrFinalGenerationApprovalService(
        repository({ commandBatch: batch({ status: "GENERATION_APPROVED" }) }),
      ).cancelBeforeGenerationApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("INVALID_BATCH_STATUS"));
    await expect(
      new QrFinalGenerationApprovalService(
        repository({ commandBatch: batch({ requestedByCurrentActor: false }) }),
      ).cancelBeforeGenerationApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("REQUESTER_REQUIRED"));
  });

  it("rejects stale, missing, and out-of-scope authoritative targets", async () => {
    await expect(
      new QrFinalGenerationApprovalService(
        repository({ commandBatch: batch({ version: 4 }) }),
      ).requestFinalApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("VERSION_CONFLICT"));
    await expect(
      new QrFinalGenerationApprovalService(repository({ commandBatch: null })).requestFinalApproval(
        {
          actor: actor("MANAGEMENT_ADMIN"),
          ...command,
        },
      ),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("BATCH_NOT_FOUND"));
    await expect(
      new QrFinalGenerationApprovalService(
        repository({
          commandBatch: batch({
            siteId: "00000000-0000-4000-8000-000000000008",
          }),
        }),
      ).requestFinalApproval({
        actor: actor("SITE_ADMIN"),
        ...command,
      }),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("rejects malformed command identity and reason before repository access", async () => {
    const repo = repository();
    const service = new QrFinalGenerationApprovalService(repo);

    await expect(
      service.requestFinalApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
        requestId: "not-a-uuid",
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("INVALID_ID"));
    await expect(
      service.requestFinalApproval({
        actor: actor("MANAGEMENT_ADMIN"),
        ...command,
        reason: " x ",
      }),
    ).rejects.toEqual(new QrFinalGenerationApprovalError("INVALID_REASON"));
    expect(repo.getBatchForCommand).not.toHaveBeenCalled();
    expect(repo.requestFinalApproval).not.toHaveBeenCalled();
  });
});
