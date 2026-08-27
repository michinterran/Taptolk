import { describe, expect, it } from "vitest";
import {
  getOperationsManagerCompleteness,
  hasManagementCompanyContactChannel,
} from "./management-company-registration-policy.js";

describe("management company registration policy", () => {
  it.each([
    [{ email: "ops@example.com", phone: "" }, true],
    [{ email: "", phone: "encrypted-phone" }, true],
    [{ email: "  ", phone: "" }, false],
  ] as const)("identifies the required primary contact channel", (input, expected) => {
    expect(hasManagementCompanyContactChannel(input)).toBe(expected);
  });

  it.each([
    [{ email: "", name: "", phone: "" }, "EMPTY"],
    [{ email: "ops@example.com", name: "", phone: "" }, "MISSING_NAME"],
    [{ email: "", name: "담당자", phone: "" }, "MISSING_CHANNEL"],
    [{ email: "", name: "담당자", phone: "encrypted-phone" }, "COMPLETE"],
  ] as const)("classifies the optional operations manager group", (input, expected) => {
    expect(getOperationsManagerCompleteness(input)).toBe(expected);
  });
});
