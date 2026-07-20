import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DevelopmentTestStageRequiredError,
  requireDevelopmentTestStage,
  resolveStagePolicy,
} from "./stage.server.js";

describe("server-only stage policy", () => {
  it.each([
    {
      expectedStatus: "FAIL_CLOSED_MISSING",
      input: {},
    },
    {
      expectedStatus: "FAIL_CLOSED_MISSING",
      input: { TAPTOLK_STAGE: "   " },
    },
    {
      expectedStatus: "FAIL_CLOSED_INVALID",
      input: { TAPTOLK_STAGE: "development" },
    },
  ] as const)("fails closed to Service for $expectedStatus", ({ expectedStatus, input }) => {
    expect(resolveStagePolicy(input)).toEqual({
      configurationStatus: expectedStatus,
      stage: "SERVICE",
      testCapabilitiesAllowed: false,
    });
  });

  it.each([
    {
      expectedAllowed: true,
      stage: "DEVELOPMENT_TEST",
    },
    {
      expectedAllowed: false,
      stage: "SERVICE",
    },
  ] as const)("resolves the configured $stage stage", ({ expectedAllowed, stage }) => {
    expect(resolveStagePolicy({ TAPTOLK_STAGE: stage })).toEqual({
      configurationStatus: "CONFIGURED",
      stage,
      testCapabilitiesAllowed: expectedAllowed,
    });
  });

  it("ignores browser-controlled stage-like input", () => {
    const browserControlledInput = {
      TAPTOLK_STAGE: "SERVICE",
      NEXT_PUBLIC_TAPTOLK_STAGE: "DEVELOPMENT_TEST",
      cookie: "taptolk_stage=DEVELOPMENT_TEST",
      header: "x-taptolk-stage: DEVELOPMENT_TEST",
      query: "stage=DEVELOPMENT_TEST",
    };

    expect(resolveStagePolicy(browserControlledInput)).toMatchObject({
      stage: "SERVICE",
      testCapabilitiesAllowed: false,
    });
  });

  it("requires an explicitly configured development and test stage", () => {
    expect(
      requireDevelopmentTestStage(resolveStagePolicy({ TAPTOLK_STAGE: "DEVELOPMENT_TEST" })),
    ).toMatchObject({ stage: "DEVELOPMENT_TEST" });
    expect(() =>
      requireDevelopmentTestStage(resolveStagePolicy({ TAPTOLK_STAGE: "SERVICE" })),
    ).toThrow(DevelopmentTestStageRequiredError);
    expect(() => requireDevelopmentTestStage(resolveStagePolicy({}))).toThrow(
      DevelopmentTestStageRequiredError,
    );
  });
});
