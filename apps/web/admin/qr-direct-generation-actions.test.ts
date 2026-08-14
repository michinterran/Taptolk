import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const tenantId = id("1");
const managementCompanyId = id("2");
const siteId = id("3");
const requestId = id("4");

const mocks = vi.hoisted(() => ({
  enqueueWake: vi.fn(),
  redirect: vi.fn(),
  request: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("../auth/admin-authorization", () => ({
  toAdminAuthorizationContext: () => ({
    mfaVerified: true,
    role: "SUPER_ADMIN",
    scope: {
      tenantId,
      type: "TENANT",
    },
  }),
}));

vi.mock("../auth/page-guard", () => ({
  requireReadyAdminContext: vi.fn(async () => ({
    decision: { membership: { role: "SUPER_ADMIN" } },
    mfaLevel: "aal2",
    userId: id("5"),
  })),
}));

vi.mock("../auth/server-client", () => ({
  createAdminServerClient: vi.fn(async () => ({ rpc: vi.fn() })),
}));

vi.mock("../internal/qr-generation-pipeline-wake", () => ({
  enqueueQrGenerationPipelineWake: mocks.enqueueWake,
}));

vi.mock("./supabase-qr-direct-generation-repository", () => ({
  createSupabaseQrDirectGenerationRepository: () => ({
    request: mocks.request,
  }),
  QrDirectGenerationRepositoryError: class QrDirectGenerationRepositoryError extends Error {
    constructor(readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE") {
      super(code);
    }
  },
}));

import { requestAdminDirectQrGeneration } from "./qr-direct-generation-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enqueueWake.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  });
  mocks.request.mockResolvedValue({
    batches: [
      {
        batchCode: "BATCH01",
        batchId: id("10"),
        batchStatus: "GENERATION_APPROVED",
        batchVersion: 1,
        generationRevision: 1,
        jobId: id("20"),
        jobStatus: "PENDING_DELIVERY",
        requestedQuantity: 100,
      },
      {
        batchCode: "BATCH02",
        batchId: id("11"),
        batchStatus: "GENERATION_APPROVED",
        batchVersion: 1,
        generationRevision: 1,
        jobId: id("21"),
        jobStatus: "PENDING_DELIVERY",
        requestedQuantity: 1,
      },
    ],
    requestId,
    siteId,
    totalQuantity: 101,
  });
});

describe("QR direct generation server action", () => {
  it("wakes the Vercel pipeline once for every created batch", async () => {
    const formData = new FormData();
    formData.set("locale", "ko");
    formData.set("companyId", managementCompanyId);
    formData.set("siteId", siteId);
    formData.set("quantity", "101");
    formData.set("expectedSiteVersion", "7");
    formData.set("idempotencyKey", id("30"));
    formData.set("reason", "운영자 직접 생성");

    await expect(requestAdminDirectQrGeneration(formData)).rejects.toThrow(
      "REDIRECT:/ko/admin/qr-inventory?",
    );

    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSiteVersion: 7,
        quantity: 101,
        siteId,
      }),
    );
    expect(mocks.enqueueWake).toHaveBeenCalledTimes(2);
    expect(mocks.enqueueWake).toHaveBeenNthCalledWith(1, {
      batchId: id("10"),
      requestId,
    });
    expect(mocks.enqueueWake).toHaveBeenNthCalledWith(2, {
      batchId: id("11"),
      requestId,
    });
  });
});
