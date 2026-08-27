import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import {
  processQueueJob,
  QR_GENERATION_QUEUE_JOB_TYPE,
  QUEUE_JOB_SCHEMA_VERSION,
  type QueueJob,
  queueJobSchema,
} from "./queue-consumer.js";

const VALID_JOB = {
  batchId: "00000000-0000-4000-8000-000000000201",
  createdAt: "2026-07-19T06:00:00.000Z",
  deliveryAttempt: 1,
  generationRevision: 1,
  jobId: "00000000-0000-4000-8000-000000000101",
  jobType: QR_GENERATION_QUEUE_JOB_TYPE,
  schemaVersion: QUEUE_JOB_SCHEMA_VERSION,
  siteId: "00000000-0000-4000-8000-000000000301",
  tenantId: "00000000-0000-4000-8000-000000000401",
  traceId: "00000000-0000-4000-8000-000000000501",
} satisfies QueueJob;

describe("versioned Queue job contract", () => {
  it("parses the supported redacted QR generation payload", () => {
    expect(queueJobSchema.parse(VALID_JOB)).toEqual(VALID_JOB);
    expect(Object.keys(VALID_JOB).sort()).toEqual(
      [
        "batchId",
        "createdAt",
        "deliveryAttempt",
        "generationRevision",
        "jobId",
        "jobType",
        "schemaVersion",
        "siteId",
        "tenantId",
        "traceId",
      ].sort(),
    );
  });

  it("rejects an unknown schema version", () => {
    expect(() =>
      queueJobSchema.parse({
        ...VALID_JOB,
        schemaVersion: QUEUE_JOB_SCHEMA_VERSION + 1,
      }),
    ).toThrow(ZodError);
  });

  it.each([
    ["activationCode", "123456"],
    ["authorizationHeader", "redacted"],
    ["cookie", "redacted"],
    ["messageBody", "redacted"],
    ["phoneNumber", "redacted"],
    ["publicToken", "redacted"],
    ["queueCredential", "redacted"],
    ["reason", "redacted"],
    ["storagePath", "redacted"],
  ])("rejects prohibited or arbitrary field %s", (field, value) => {
    expect(() => queueJobSchema.parse({ ...VALID_JOB, [field]: value })).toThrow(ZodError);
  });

  it.each([
    ["deliveryAttempt", 0],
    ["generationRevision", 0],
    ["jobType", "UNKNOWN_JOB"],
    ["siteId", null],
  ])("rejects invalid required field %s", (field, value) => {
    expect(() => queueJobSchema.parse({ ...VALID_JOB, [field]: value })).toThrow(ZodError);
  });

  it("validates before invoking the registered handler", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);

    await expect(
      processQueueJob(VALID_JOB, {
        QR_GENERATION: handler,
      }),
    ).resolves.toEqual(VALID_JOB);
    expect(handler).toHaveBeenCalledWith(VALID_JOB);

    await expect(
      processQueueJob(
        {
          ...VALID_JOB,
          publicToken: "must-not-reach-handler",
        },
        { QR_GENERATION: handler },
      ),
    ).rejects.toBeInstanceOf(ZodError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects a supported payload when no owning handler is registered", async () => {
    await expect(processQueueJob(VALID_JOB, {})).rejects.toThrow(
      "Unsupported queue job type: QR_GENERATION",
    );
  });
});
