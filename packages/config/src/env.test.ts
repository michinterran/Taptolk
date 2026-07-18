import { describe, expect, it } from "vitest";
import { parseClientEnvironment } from "./env.client.js";
import { parseServerEnvironment } from "./env.server.js";

describe("environment contracts", () => {
  it("uses safe local defaults without inventing external credentials", () => {
    const environment = parseServerEnvironment({});

    expect(environment.APP_ENV).toBe("local");
    expect(environment.SMS_PROVIDER).toBe("mock");
    expect(environment.DATABASE_URL).toBeUndefined();
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
});
