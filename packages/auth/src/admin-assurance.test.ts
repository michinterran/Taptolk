import { describe, expect, it } from "vitest";
import { hasRequiredAdminAssurance } from "./admin-assurance.js";

describe("admin authentication assurance", () => {
  it("requires aal2 for Site Admin", () => {
    expect(
      hasRequiredAdminAssurance("SITE_ADMIN", {
        authenticated: true,
        mfaLevel: "aal1",
      }),
    ).toBe(false);
    expect(
      hasRequiredAdminAssurance("SITE_ADMIN", {
        authenticated: true,
        mfaLevel: "aal2",
      }),
    ).toBe(true);
  });

  it("accepts aal1 for Site Operator", () => {
    expect(
      hasRequiredAdminAssurance("SITE_OPERATOR", {
        authenticated: true,
        mfaLevel: "aal1",
      }),
    ).toBe(true);
  });
});
