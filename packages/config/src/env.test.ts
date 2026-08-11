import { describe, expect, it } from "vitest";
import { parseClientEnvironment } from "./env.client.js";
import { parseServerEnvironment } from "./env.server.js";

describe("environment contracts", () => {
  it("uses safe local defaults without inventing external credentials", () => {
    const environment = parseServerEnvironment({});

    expect(environment.APP_ENV).toBe("local");
    expect(environment.APP_ENCRYPTION_KEY_VERSION).toBe(1);
    expect(environment.OWNER_NOTIFICATION_PROVIDER).toBe("mock");
    expect(environment.OWNER_VERIFICATION_PROVIDER).toBe("mock");
    expect(environment.DATABASE_URL).toBeUndefined();
    expect(environment.QR_GENERATION_QUEUE_NAME).toBe("qr-generation");
    expect(environment.QR_GENERATION_DISPATCH_CLAIM_LIMIT).toBe(10);
    expect(environment.QR_GENERATION_DISPATCH_LEASE_SECONDS).toBe(60);
    expect(environment.QR_GENERATION_DISPATCH_DURATION_BUDGET_MS).toBe(8_000);
    expect(environment.QR_GENERATION_QUEUE_SEND_TIMEOUT_MS).toBe(3_000);
    expect(environment.QR_GENERATION_QUEUE_MAX_READ_COUNT).toBe(5);
    expect(environment.QR_GENERATION_QUEUE_POLL_INTERVAL_MS).toBe(1_000);
    expect(environment.QR_GENERATION_QUEUE_VISIBILITY_TIMEOUT_SECONDS).toBe(3_600);
    expect(environment.QR_GENERATION_DELIVERY_RETRY_BASE_DELAY_MS).toBe(5_000);
    expect(environment.QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS).toBe(300_000);
    expect(environment.QR_GENERATION_DELIVERY_RETRY_JITTER_RATIO).toBe(0.2);
    expect(environment.PRIVACY_CLEANUP_DURATION_BUDGET_MS).toBe(45_000);
    expect(environment.PRIVACY_CLEANUP_TENANT_LIMIT).toBe(25);
  });

  it("rejects a production environment without server secrets", () => {
    expect(() => parseServerEnvironment({ APP_ENV: "production" })).toThrow();
  });

  it("returns only explicitly allowed browser variables", () => {
    const environment = parseClientEnvironment({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"a".repeat(24)}`,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "must-not-cross-the-boundary",
    });

    expect(Object.keys(environment).sort()).toEqual([
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
  });

  it("keeps SOLAPI SMS credentials server-only and parses a digits-only sender", () => {
    const environment = parseServerEnvironment({
      OWNER_NOTIFICATION_PROVIDER: "solapi-sms",
      SOLAPI_API_KEY: "NCSAYU7YDBXYORXC",
      SOLAPI_API_SECRET: `solapi-api-secret-${"b".repeat(24)}`,
      SOLAPI_SMS_FROM: "0212345678",
    });

    expect(environment).toMatchObject({
      OWNER_NOTIFICATION_PROVIDER: "solapi-sms",
      SOLAPI_SMS_FROM: "0212345678",
    });
    expect(Object.keys(environment)).not.toContain("NEXT_PUBLIC_SOLAPI_API_SECRET");
  });

  it("accepts SOLAPI as the owner OTP verification provider", () => {
    const environment = parseServerEnvironment({
      OWNER_VERIFICATION_PROVIDER: "solapi-sms",
      SOLAPI_API_KEY: "NCSAYU7YDBXYORXC",
      SOLAPI_API_SECRET: "b".repeat(32),
      SOLAPI_SMS_FROM: "01012345678",
    });

    expect(environment.OWNER_VERIFICATION_PROVIDER).toBe("solapi-sms");
  });

  it("rejects the unimplemented AlimTalk provider until business approval", () => {
    expect(() =>
      parseServerEnvironment({
        OWNER_NOTIFICATION_PROVIDER: "kakao-alimtalk",
      }),
    ).toThrow();
  });

  it("rejects a sender with formatting characters", () => {
    expect(() =>
      parseServerEnvironment({
        OWNER_NOTIFICATION_PROVIDER: "solapi-sms",
        SOLAPI_SMS_FROM: "010-1234-5678",
      }),
    ).toThrow();
  });

  it("rejects legacy or malformed hosted API keys", () => {
    expect(() =>
      parseClientEnvironment({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "legacy-anon-key",
      }),
    ).toThrow();
    expect(() =>
      parseServerEnvironment({
        SUPABASE_SECRET_KEY: "legacy-service-role-key",
      }),
    ).toThrow();
  });

  it("parses bounded QR generation dispatch policy from server configuration", () => {
    const environment = parseServerEnvironment({
      QR_GENERATION_DELIVERY_RETRY_BASE_DELAY_MS: "2000",
      QR_GENERATION_DELIVERY_RETRY_JITTER_RATIO: "0.1",
      QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS: "10000",
      QR_GENERATION_DISPATCH_CLAIM_LIMIT: "4",
      QR_GENERATION_DISPATCH_DURATION_BUDGET_MS: "5000",
      QR_GENERATION_DISPATCH_LEASE_SECONDS: "45",
      QR_GENERATION_QUEUE_NAME: "qr_generation_staging",
      QR_GENERATION_QUEUE_MAX_READ_COUNT: "4",
      QR_GENERATION_QUEUE_POLL_INTERVAL_MS: "750",
      QR_GENERATION_QUEUE_SEND_TIMEOUT_MS: "2500",
      QR_GENERATION_QUEUE_VISIBILITY_TIMEOUT_SECONDS: "7200",
    });

    expect(environment).toMatchObject({
      QR_GENERATION_DELIVERY_RETRY_BASE_DELAY_MS: 2_000,
      QR_GENERATION_DELIVERY_RETRY_JITTER_RATIO: 0.1,
      QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS: 10_000,
      QR_GENERATION_DISPATCH_CLAIM_LIMIT: 4,
      QR_GENERATION_DISPATCH_DURATION_BUDGET_MS: 5_000,
      QR_GENERATION_DISPATCH_LEASE_SECONDS: 45,
      QR_GENERATION_QUEUE_NAME: "qr_generation_staging",
      QR_GENERATION_QUEUE_MAX_READ_COUNT: 4,
      QR_GENERATION_QUEUE_POLL_INTERVAL_MS: 750,
      QR_GENERATION_QUEUE_SEND_TIMEOUT_MS: 2_500,
      QR_GENERATION_QUEUE_VISIBILITY_TIMEOUT_SECONDS: 7_200,
    });
  });

  it.each([
    { QR_GENERATION_DISPATCH_CLAIM_LIMIT: "51" },
    { QR_GENERATION_DISPATCH_LEASE_SECONDS: "4" },
    { QR_GENERATION_DISPATCH_DURATION_BUDGET_MS: "999" },
    { QR_GENERATION_QUEUE_NAME: "QR Generation" },
    { QR_GENERATION_QUEUE_MAX_READ_COUNT: "21" },
    { QR_GENERATION_QUEUE_POLL_INTERVAL_MS: "249" },
    { QR_GENERATION_QUEUE_SEND_TIMEOUT_MS: "10001" },
    { QR_GENERATION_QUEUE_VISIBILITY_TIMEOUT_SECONDS: "59" },
    {
      QR_GENERATION_DISPATCH_DURATION_BUDGET_MS: "1000",
      QR_GENERATION_QUEUE_SEND_TIMEOUT_MS: "1001",
    },
    {
      QR_GENERATION_DELIVERY_RETRY_BASE_DELAY_MS: "5000",
      QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS: "4999",
    },
    { QR_GENERATION_DELIVERY_RETRY_JITTER_RATIO: "0.51" },
  ])("rejects invalid QR generation dispatch configuration %o", (input) => {
    expect(() => parseServerEnvironment(input)).toThrow();
  });

  it.each([
    { PRIVACY_CLEANUP_DURATION_BUDGET_MS: "999" },
    { PRIVACY_CLEANUP_DURATION_BUDGET_MS: "55001" },
    { PRIVACY_CLEANUP_TENANT_LIMIT: "0" },
    { PRIVACY_CLEANUP_TENANT_LIMIT: "101" },
  ])("rejects invalid scheduled privacy cleanup configuration %o", (input) => {
    expect(() => parseServerEnvironment(input)).toThrow();
  });
});
