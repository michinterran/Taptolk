import type { QrGenerationQueueMessage } from "@taptolk/application";
import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseQrGenerationQueuePublisher,
  SupabaseQrGenerationQueuePublisherConfigurationError,
  type SupabaseQueueClient,
} from "./supabase-qr-generation-queue-publisher.js";

const MESSAGE: QrGenerationQueueMessage = {
  batchId: "00000000-0000-4000-8000-000000000201",
  createdAt: "2026-07-19T06:00:00.000Z",
  deliveryAttempt: 1,
  generationRevision: 1,
  jobId: "00000000-0000-4000-8000-000000000101",
  jobType: "QR_GENERATION",
  schemaVersion: 1,
  siteId: "00000000-0000-4000-8000-000000000301",
  tenantId: "00000000-0000-4000-8000-000000000401",
  traceId: "00000000-0000-4000-8000-000000000101",
};

function client(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  const abortSignal = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ abortSignal }));
  const schema = vi.fn(() => ({ rpc }));
  return {
    abortSignal,
    client: { schema } satisfies SupabaseQueueClient,
    rpc,
    schema,
  };
}

const CONFIG = {
  queueName: "qr-generation",
  requestTimeoutMs: 3_000,
};

describe("Supabase QR generation Queue publisher", () => {
  it("sends the strict v1 message to pgmq_public with no provider delay", async () => {
    const target = client({ data: [42], error: null });
    const publisher = createSupabaseQrGenerationQueuePublisher(target.client, CONFIG);

    await expect(publisher.publish(MESSAGE)).resolves.toEqual({
      queueMessageId: "42",
    });
    expect(target.schema).toHaveBeenCalledWith("pgmq_public");
    expect(target.rpc).toHaveBeenCalledWith("send", {
      message: MESSAGE,
      queue_name: "qr-generation",
      sleep_seconds: 0,
    });
    const signal = target.abortSignal.mock.calls[0]?.[0];
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it.each([[1], ["9223372036854775807"], 7] as const)(
    "normalizes one positive provider message identifier from %o",
    async (data) => {
      const target = client({ data, error: null });
      const publisher = createSupabaseQrGenerationQueuePublisher(target.client, CONFIG);

      await expect(publisher.publish(MESSAGE)).resolves.toEqual({
        queueMessageId: Array.isArray(data) ? String(data[0]) : String(data),
      });
    },
  );

  it.each([
    null,
    [],
    [1, 2],
    [0],
    [-1],
    [1.5],
    [Number.MAX_SAFE_INTEGER + 1],
    ["0"],
    ["01"],
    [{ msg_id: 1 }],
  ])("fails closed on malformed provider response %o", async (data) => {
    const target = client({ data, error: null });
    const publisher = createSupabaseQrGenerationQueuePublisher(target.client, CONFIG);

    await expect(publisher.publish(MESSAGE)).rejects.toMatchObject({
      code: "QUEUE_UNAVAILABLE",
      name: "QrGenerationQueuePublisherError",
    });
  });

  it.each([
    { code: "429", message: "provider detail" },
    { code: "TOO_MANY_REQUESTS", message: "provider detail" },
    { code: "PGRST000", message: "rate limit exceeded" },
  ])("reduces explicit provider throttling without exposing details", async (error) => {
    const target = client({ data: null, error });
    const publisher = createSupabaseQrGenerationQueuePublisher(target.client, CONFIG);

    await expect(publisher.publish(MESSAGE)).rejects.toMatchObject({
      code: "QUEUE_RATE_LIMITED",
      message: expect.not.stringContaining("provider detail"),
    });
  });

  it("reduces unknown provider and network failures to unavailable", async () => {
    const target = client({
      data: null,
      error: { code: "42501", message: "raw permission detail" },
    });
    const publisher = createSupabaseQrGenerationQueuePublisher(target.client, CONFIG);

    await expect(publisher.publish(MESSAGE)).rejects.toMatchObject({
      code: "QUEUE_UNAVAILABLE",
      message: expect.not.stringContaining("raw permission detail"),
    });

    target.abortSignal.mockRejectedValueOnce(new Error("raw network detail"));
    await expect(publisher.publish(MESSAGE)).rejects.toMatchObject({
      code: "QUEUE_UNAVAILABLE",
      message: expect.not.stringContaining("raw network detail"),
    });
  });

  it.each([
    [{ ...CONFIG, queueName: "QR Generation" }, "INVALID_QUEUE_NAME"],
    [{ ...CONFIG, queueName: "../qr-generation" }, "INVALID_QUEUE_NAME"],
    [{ ...CONFIG, requestTimeoutMs: 249 }, "INVALID_REQUEST_TIMEOUT"],
    [{ ...CONFIG, requestTimeoutMs: 10_001 }, "INVALID_REQUEST_TIMEOUT"],
  ] as const)("rejects invalid provider configuration %o", (config, code) => {
    expect(() =>
      createSupabaseQrGenerationQueuePublisher(client({ data: [1], error: null }).client, config),
    ).toThrow(expect.objectContaining({ code }));
  });

  it("uses a typed configuration error", () => {
    expect(
      new SupabaseQrGenerationQueuePublisherConfigurationError("INVALID_QUEUE_NAME"),
    ).toMatchObject({
      name: "SupabaseQrGenerationQueuePublisherConfigurationError",
    });
  });
});
