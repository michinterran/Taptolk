import { describe, expect, it } from "vitest";
import { createTaptolkAdminClient } from "./supabase-client.js";

describe("Supabase admin client boundary", () => {
  it("creates a non-persistent server client from a valid secret configuration", () => {
    const client = createTaptolkAdminClient({
      secretKey: `sb_secret_${"a".repeat(24)}`,
      url: "https://example.supabase.co",
    });

    expect(client.auth.admin).toBeDefined();
  });

  it("rejects public or malformed credentials", () => {
    expect(() =>
      createTaptolkAdminClient({
        secretKey: `sb_publishable_${"a".repeat(24)}`,
        url: "https://example.supabase.co",
      }),
    ).toThrow("A valid Supabase secret key is required.");
  });
});
