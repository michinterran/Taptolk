import { describe, expect, it } from "vitest";
import { createQrQueueWorkerRuntime } from "./runtime.js";

describe("QR queue worker runtime initialization", () => {
  it("reports only the missing required variable names", async () => {
    await expect(createQrQueueWorkerRuntime({})).resolves.toEqual({
      missingVariables: [
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SECRET_KEY",
        "APP_ENCRYPTION_KEY_V1",
        "PUBLIC_QR_BASE_URL",
      ],
      ready: false,
    });
  });

  it("accepts the dedicated QR credential key in place of the legacy v1 key", async () => {
    const result = await createQrQueueWorkerRuntime({
      QR_CREDENTIAL_ENCRYPTION_KEY_V2: "x".repeat(32),
    });
    expect(result).toEqual({
      missingVariables: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "PUBLIC_QR_BASE_URL"],
      ready: false,
    });
  });
});
