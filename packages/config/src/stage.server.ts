import "server-only";

export const TAPTOLK_STAGES = ["DEVELOPMENT_TEST", "SERVICE"] as const;

export type TaptolkStage = (typeof TAPTOLK_STAGES)[number];
export type StageConfigurationStatus = "CONFIGURED" | "FAIL_CLOSED_INVALID" | "FAIL_CLOSED_MISSING";

export interface StagePolicy {
  readonly configurationStatus: StageConfigurationStatus;
  readonly stage: TaptolkStage;
  readonly testCapabilitiesAllowed: boolean;
}

export interface ServerStageEnvironment {
  readonly TAPTOLK_STAGE?: string | undefined;
}

export class DevelopmentTestStageRequiredError extends Error {
  readonly code = "DEVELOPMENT_TEST_STAGE_REQUIRED";

  constructor() {
    super("This capability is unavailable outside the development and test stage.");
    this.name = "DevelopmentTestStageRequiredError";
  }
}

const DEVELOPMENT_TEST_POLICY = Object.freeze({
  configurationStatus: "CONFIGURED",
  stage: "DEVELOPMENT_TEST",
  testCapabilitiesAllowed: true,
} satisfies StagePolicy);

const SERVICE_POLICY = Object.freeze({
  configurationStatus: "CONFIGURED",
  stage: "SERVICE",
  testCapabilitiesAllowed: false,
} satisfies StagePolicy);

function failClosedPolicy(
  configurationStatus: Exclude<StageConfigurationStatus, "CONFIGURED">,
): StagePolicy {
  return Object.freeze({
    configurationStatus,
    stage: "SERVICE",
    testCapabilitiesAllowed: false,
  });
}

export function resolveStagePolicy(
  environment: ServerStageEnvironment = { TAPTOLK_STAGE: process.env.TAPTOLK_STAGE },
): StagePolicy {
  const configuredStage = environment.TAPTOLK_STAGE?.trim();
  if (configuredStage === "DEVELOPMENT_TEST") {
    return DEVELOPMENT_TEST_POLICY;
  }
  if (configuredStage === "SERVICE") {
    return SERVICE_POLICY;
  }
  return failClosedPolicy(
    configuredStage === undefined || configuredStage === ""
      ? "FAIL_CLOSED_MISSING"
      : "FAIL_CLOSED_INVALID",
  );
}

export function requireDevelopmentTestStage(
  policy: StagePolicy = resolveStagePolicy(),
): StagePolicy {
  if (!policy.testCapabilitiesAllowed || policy.stage !== "DEVELOPMENT_TEST") {
    throw new DevelopmentTestStageRequiredError();
  }
  return policy;
}
