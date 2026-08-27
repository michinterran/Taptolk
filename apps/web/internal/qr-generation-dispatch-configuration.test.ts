import { parseServerEnvironment } from "@taptolk/config";
import { describe, expect, it } from "vitest";
import { buildStagingQrGenerationDispatchConfiguration } from "./qr-generation-dispatch-configuration";

const STAGING_ENVIRONMENT = parseServerEnvironment({
  APP_ENV: "staging",
  CRON_SECRET: "staging-cron-secret-value-123456789",
  NODE_ENV: "test",
  SUPABASE_SECRET_KEY: `sb_secret_${"a".repeat(24)}`,
});

describe("staging QR generation dispatch configuration", () => {
  it("projects only the reviewed staging runtime policy", () => {
    expect(buildStagingQrGenerationDispatchConfiguration(STAGING_ENVIRONMENT)).toEqual({
      cronSecret: "staging-cron-secret-value-123456789",
      publisher: {
        queueName: "qr-generation",
        requestTimeoutMs: 3_000,
      },
      retry: {
        baseDelayMs: 5_000,
        jitterRatio: 0.2,
        maxDelayMs: 300_000,
      },
      runtime: {
        claimLimit: 10,
        durationBudgetMs: 8_000,
        leaseSeconds: 60,
      },
    });
  });

  it.each(["local", "production"] as const)("rejects the %s environment", (appEnvironment) => {
    expect(
      buildStagingQrGenerationDispatchConfiguration({
        ...STAGING_ENVIRONMENT,
        APP_ENV: appEnvironment,
      }),
    ).toBeNull();
  });

  it("rejects missing internal and provider credentials", () => {
    expect(
      buildStagingQrGenerationDispatchConfiguration({
        ...STAGING_ENVIRONMENT,
        CRON_SECRET: undefined,
      }),
    ).toBeNull();
    expect(
      buildStagingQrGenerationDispatchConfiguration({
        ...STAGING_ENVIRONMENT,
        SUPABASE_SECRET_KEY: undefined,
      }),
    ).toBeNull();
  });
});
