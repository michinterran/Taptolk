import { describe, expect, it } from "vitest";
import {
  ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH,
  validateAdminRegistration,
} from "./admin-registration.js";

describe("admin registration validation", () => {
  it("normalizes a valid email without changing the password", () => {
    const password = "correct horse battery staple";

    expect(
      validateAdminRegistration({
        email: " Admin@Example.com ",
        password,
        passwordConfirmation: password,
      }),
    ).toEqual({
      email: "admin@example.com",
      password,
      valid: true,
    });
  });

  it("rejects passwords below the registration policy", () => {
    const password = "x".repeat(ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH - 1);

    expect(
      validateAdminRegistration({
        email: "admin@example.com",
        password,
        passwordConfirmation: password,
      }),
    ).toEqual({ error: "INVALID_PASSWORD", valid: false });
  });

  it.each(["admin", "@example.com", "admin@example", "admin @example.com"])(
    "rejects malformed email %s",
    (email) => {
      const password = "correct horse battery staple";

      expect(
        validateAdminRegistration({
          email,
          password,
          passwordConfirmation: password,
        }),
      ).toEqual({ error: "INVALID_EMAIL", valid: false });
    },
  );

  it("rejects mismatched password confirmation", () => {
    expect(
      validateAdminRegistration({
        email: "admin@example.com",
        password: "correct horse battery staple",
        passwordConfirmation: "different secure password",
      }),
    ).toEqual({ error: "PASSWORD_MISMATCH", valid: false });
  });
});
