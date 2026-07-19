import type { AdminAuthorizationContext } from "@taptolk/domain";
import { describe, expect, it, vi } from "vitest";
import {
  QrInventorySampleError,
  type QrInventorySampleRepository,
  QrInventorySampleService,
  type StickerDesignVersionItem,
} from "./qr-inventory-sample-service.js";

const IDS = {
  actor: "00000000-0000-4000-8000-000000000001",
  batch: "00000000-0000-4000-8000-000000000002",
  company: "00000000-0000-4000-8000-000000000003",
  design: "00000000-0000-4000-8000-000000000004",
  other: "00000000-0000-4000-8000-000000000005",
  request: "00000000-0000-4000-8000-000000000006",
  sample: "00000000-0000-4000-8000-000000000007",
  site: "00000000-0000-4000-8000-000000000008",
  tenant: "00000000-0000-4000-8000-000000000009",
} as const;

function actor(role: AdminAuthorizationContext["role"], userId: string = IDS.actor) {
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
  return { authorization: { mfaVerified: true, role, scope }, userId };
}

function design(overrides: Partial<StickerDesignVersionItem> = {}): StickerDesignVersionItem {
  return {
    approvedAt: null,
    createdAt: "2026-07-19T00:00:00.000Z",
    createdByCurrentActor: false,
    designConfig: { layout: "default" },
    id: IDS.design,
    managementCompanyId: IDS.company,
    siteId: IDS.site,
    siteName: "Site",
    status: "DRAFT",
    templateCode: "ROUND_WHITE_MINIMAL_V1",
    tenantId: IDS.tenant,
    version: 1,
    ...overrides,
  };
}

function repository(): QrInventorySampleRepository {
  const result = {
    relatedResourceId: null,
    relatedVersion: null,
    resourceId: IDS.design,
    version: 1,
  };
  return {
    approveDesign: vi.fn().mockResolvedValue(result),
    approveSample: vi.fn().mockResolvedValue(result),
    archiveDesign: vi.fn().mockResolvedValue(result),
    attachSample: vi.fn().mockResolvedValue(result),
    cancelBatch: vi.fn().mockResolvedValue(result),
    createDesign: vi.fn().mockResolvedValue(result),
    invalidateSample: vi.fn().mockResolvedValue(result),
    list: vi.fn().mockResolvedValue({ batches: [], designs: [], sites: [] }),
    requestBatch: vi.fn().mockResolvedValue(result),
  };
}

const scope = {
  managementCompanyId: IDS.company,
  siteId: IDS.site,
  tenantId: IDS.tenant,
} as const;

describe("QrInventorySampleService", () => {
  it("normalizes a Site-scoped Design DRAFT command", async () => {
    const repo = repository();
    const service = new QrInventorySampleService(repo);

    await service.createDesign({
      actor: actor("SITE_ADMIN"),
      auditRequestId: IDS.request,
      designConfig: '{ "layout": "round" }',
      expectedSiteVersion: 1,
      reason: "  New parking sticker  ",
      siteStatus: "ACTIVE",
      templateCode: " round_white_minimal_v1 ",
      ...scope,
    });

    expect(repo.createDesign).toHaveBeenCalledWith(
      expect.objectContaining({
        designConfig: { layout: "round" },
        reason: "New parking sticker",
        templateCode: "ROUND_WHITE_MINIMAL_V1",
      }),
    );
  });

  it("rejects malformed or oversized Design config before repository access", async () => {
    const repo = repository();
    const service = new QrInventorySampleService(repo);

    await expect(
      service.createDesign({
        actor: actor("SITE_ADMIN"),
        auditRequestId: IDS.request,
        designConfig: "[]",
        expectedSiteVersion: 1,
        reason: "New parking sticker",
        siteStatus: "ACTIVE",
        templateCode: "ROUND_WHITE_MINIMAL_V1",
        ...scope,
      }),
    ).rejects.toEqual(new QrInventorySampleError("INVALID_DESIGN_CONFIG"));
    expect(repo.createDesign).not.toHaveBeenCalled();
  });

  it("enforces independent Design approval", async () => {
    const service = new QrInventorySampleService(repository());

    await expect(
      service.approveDesign({
        actor: actor("MANAGEMENT_ADMIN"),
        auditRequestId: IDS.request,
        createdByCurrentActor: true,
        designId: IDS.design,
        expectedVersion: 1,
        reason: "Layout reviewed",
        status: "DRAFT",
        ...scope,
      }),
    ).rejects.toEqual(new QrInventorySampleError("SELF_REVIEW_FORBIDDEN"));
  });

  it("requires an active Site and approved Design for a small Batch", async () => {
    const service = new QrInventorySampleService(repository());

    await expect(
      service.requestBatch({
        actor: actor("SITE_ADMIN"),
        auditRequestId: IDS.request,
        designStatus: "DRAFT",
        expectedDesignVersion: 1,
        expectedSiteVersion: 1,
        idempotencyKey: IDS.batch,
        purpose: "Resident distribution",
        quantity: 20,
        reason: "Initial sample review",
        siteStatus: "ACTIVE",
        stickerDesignVersionId: IDS.design,
        ...scope,
      }),
    ).rejects.toEqual(new QrInventorySampleError("INVALID_DESIGN_STATUS"));
  });

  it("enforces the reviewed 1-100 quantity policy", async () => {
    const service = new QrInventorySampleService(repository());

    await expect(
      service.requestBatch({
        actor: actor("SITE_ADMIN"),
        auditRequestId: IDS.request,
        designStatus: "APPROVED",
        expectedDesignVersion: 1,
        expectedSiteVersion: 1,
        idempotencyKey: IDS.batch,
        purpose: "Resident distribution",
        quantity: 10_001,
        reason: "Initial sample review",
        siteStatus: "ACTIVE",
        stickerDesignVersionId: IDS.design,
        ...scope,
      }),
    ).rejects.toEqual(new QrInventorySampleError("INVALID_QUANTITY"));
  });

  it("normalizes passing sample artifact metadata", async () => {
    const repo = repository();
    const service = new QrInventorySampleService(repo);
    const checksum = "A".repeat(64);

    await service.attachSample({
      actor: actor("PLATFORM_OPERATOR"),
      auditRequestId: IDS.request,
      batchId: IDS.batch,
      batchStatus: "DRAFT",
      byteSize: 2048,
      checksumSha256: checksum,
      contrastPassed: true,
      decodePassed: true,
      expectedBatchVersion: 1,
      mimeType: "image/png",
      quietZonePassed: true,
      reason: "Renderer output attached",
      storageBucket: "qr-samples",
      storagePath: "tenant/site/sample.png",
      ...scope,
    });

    expect(repo.attachSample).toHaveBeenCalledWith(
      expect.objectContaining({ checksumSha256: checksum.toLowerCase() }),
    );
  });

  it("requires all QA evidence and an independent Batch sample checker", async () => {
    const service = new QrInventorySampleService(repository());
    const base = {
      actor: actor("SITE_ADMIN"),
      auditRequestId: IDS.request,
      batchId: IDS.batch,
      batchStatus: "SAMPLE_READY" as const,
      contrastPassed: true,
      decodePassed: true,
      expectedBatchVersion: 2,
      expectedSampleVersion: 1,
      quietZonePassed: true,
      reason: "Sample inspected",
      requestedByCurrentActor: true,
      sampleId: IDS.sample,
      sampleStatus: "READY" as const,
      ...scope,
    };

    await expect(service.approveSample(base)).rejects.toEqual(
      new QrInventorySampleError("SELF_REVIEW_FORBIDDEN"),
    );
    await expect(
      service.approveSample({
        ...base,
        actor: actor("SITE_ADMIN", IDS.other),
        decodePassed: false,
        requestedByCurrentActor: false,
      }),
    ).rejects.toEqual(new QrInventorySampleError("QA_REQUIRED"));
  });

  it("derives independent Design and sample queues", async () => {
    const repo = repository();
    const ownDesign = design({ createdByCurrentActor: true });
    const reviewDesign = design({ id: IDS.request });
    vi.mocked(repo.list).mockResolvedValue({
      batches: [
        {
          batchCode: "ABC123",
          createdAt: "2026-07-19T00:00:00.000Z",
          id: IDS.batch,
          managementCompanyId: IDS.company,
          purpose: "Resident distribution",
          requestedByCurrentActor: false,
          requestedQuantity: 20,
          sample: null,
          siteId: IDS.site,
          siteName: "Site",
          status: "SAMPLE_READY",
          stickerDesignVersionId: IDS.design,
          templateCode: "ROUND_WHITE_MINIMAL_V1",
          tenantId: IDS.tenant,
          version: 2,
        },
      ],
      designs: [ownDesign, reviewDesign, design({ id: IDS.batch, status: "APPROVED" })],
      sites: [],
    });

    const model = await new QrInventorySampleService(repo).list({
      actor: actor("MANAGEMENT_ADMIN"),
    });

    expect(model.designApprovalQueue.map((item) => item.id)).toEqual([IDS.request]);
    expect(model.sampleApprovalQueue.map((item) => item.id)).toEqual([IDS.batch]);
    expect(model.approvedDesignOptions).toHaveLength(1);
  });

  it("keeps read-only roles out of mutation queues", async () => {
    const repo = repository();
    vi.mocked(repo.list).mockResolvedValue({ batches: [], designs: [design()], sites: [] });

    const model = await new QrInventorySampleService(repo).list({
      actor: actor("READ_ONLY"),
    });

    expect(model.designApprovalQueue).toEqual([]);
    expect(model.sampleApprovalQueue).toEqual([]);
  });
});
