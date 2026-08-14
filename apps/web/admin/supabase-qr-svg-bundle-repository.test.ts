import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createSupabaseQrSvgBundleRepository } from "./supabase-qr-svg-bundle-repository";

function query(result: { data: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    order: vi.fn(() => chain),
    select: vi.fn(() => chain),
  };
  return chain;
}

describe("Supabase QR SVG bundle repository", () => {
  const bytes = new TextEncoder().encode("ready-print-bundle");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const batchQuery = query({
    data: {
      batch_code: "BATCH001",
      id: "00000000-0000-4000-8000-000000000001",
      requested_quantity: 1,
      site_id: "00000000-0000-4000-8000-000000000002",
      tenant_id: "00000000-0000-4000-8000-000000000003",
    },
    error: null,
  });
  const exportQuery = query({
    data: {
      byte_size: bytes.byteLength,
      checksum_sha256: checksum,
      storage_path: "tenant/batches/batch/exports-1/BATCH001-print-bundle.zip",
    },
    error: null,
  });
  const download = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  });

  it("downloads the worker-produced ready ZIP and verifies its integrity", async () => {
    const userClient = {
      from: vi.fn(() => batchQuery),
    };
    const serviceClient = {
      from: vi.fn(() => exportQuery),
      storage: {
        from: vi.fn(() => ({ download })),
      },
    };

    const artifact = await createSupabaseQrSvgBundleRepository(
      userClient as never,
      serviceClient as never,
    ).get("00000000-0000-4000-8000-000000000001");

    expect(Array.from(artifact.bytes)).toEqual(Array.from(bytes));
    expect(artifact.checksumSha256).toBe(checksum);
    expect(artifact.filename).toBe("BATCH001-svg-bundle.zip");
    expect(download).toHaveBeenCalledTimes(1);
    expect(exportQuery.eq).toHaveBeenCalledWith("export_type", "ZIP");
    expect(exportQuery.eq).toHaveBeenCalledWith("status", "READY");
  });
});
