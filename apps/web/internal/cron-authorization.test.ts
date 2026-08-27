import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron-authorization";

const SECRET = "staging-cron-secret-value-123456789";

describe("internal Cron authorization", () => {
  it("accepts one exact bearer credential", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([
    null,
    "",
    `bearer ${SECRET}`,
    `Basic ${SECRET}`,
    "Bearer",
    "Bearer ",
    `Bearer  ${SECRET}`,
    `Bearer ${SECRET} extra`,
    `Bearer ${SECRET},Bearer ${SECRET}`,
    `Bearer ${SECRET.slice(0, -1)}x`,
  ])("rejects a malformed or mismatched authorization header %o", (header) => {
    expect(isAuthorizedCronRequest(header, SECRET)).toBe(false);
  });

  it("rejects absent or structurally invalid expected secrets", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer short-secret", "short-secret")).toBe(false);
  });
});
