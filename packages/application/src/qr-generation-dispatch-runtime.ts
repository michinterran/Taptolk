import type {
  QrGenerationDispatchOutcomeStatus,
  QrGenerationDispatchResult,
} from "./qr-generation-dispatch-coordinator.js";
import {
  QR_GENERATION_DISPATCH_CLAIM_LIMIT_MAX,
  QR_GENERATION_DISPATCH_LEASE_SECONDS_MAX,
  QR_GENERATION_DISPATCH_LEASE_SECONDS_MIN,
} from "./qr-generation-dispatcher-service.js";

export const QR_GENERATION_DISPATCH_DURATION_BUDGET_MS_MIN = 1_000;
export const QR_GENERATION_DISPATCH_DURATION_BUDGET_MS_MAX = 60_000;

const OUTCOME_STATUSES = [
  "DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING",
  "DELIVERY_RETRY_SCHEDULED",
  "PUBLICATION_ACKNOWLEDGEMENT_PENDING",
  "PUBLISHED",
] as const satisfies readonly QrGenerationDispatchOutcomeStatus[];

export interface QrGenerationDispatchRuntimePolicy {
  claimLimit: number;
  durationBudgetMs: number;
  leaseSeconds: number;
}

export interface QrGenerationDispatchRunner {
  runOnce(input: { leaseSeconds: number; limit: number }): Promise<QrGenerationDispatchResult>;
}

export interface QrGenerationDispatchRuntimeResult {
  claimedCount: number;
  completedWithinBudget: boolean;
  outcomeCounts: Readonly<Record<QrGenerationDispatchOutcomeStatus, number>>;
}

export class QrGenerationDispatchRuntimeError extends Error {
  readonly code:
    | "INVALID_CLAIM_LIMIT"
    | "INVALID_CLOCK"
    | "INVALID_DURATION_BUDGET"
    | "INVALID_LEASE_SECONDS"
    | "INVALID_RUN_RESULT";

  constructor(code: QrGenerationDispatchRuntimeError["code"]) {
    super(`QR generation dispatch runtime rejected: ${code}`);
    this.name = "QrGenerationDispatchRuntimeError";
    this.code = code;
  }
}

function assertPolicy(policy: QrGenerationDispatchRuntimePolicy): void {
  if (
    !Number.isInteger(policy.claimLimit) ||
    policy.claimLimit < 1 ||
    policy.claimLimit > QR_GENERATION_DISPATCH_CLAIM_LIMIT_MAX
  ) {
    throw new QrGenerationDispatchRuntimeError("INVALID_CLAIM_LIMIT");
  }
  if (
    !Number.isInteger(policy.leaseSeconds) ||
    policy.leaseSeconds < QR_GENERATION_DISPATCH_LEASE_SECONDS_MIN ||
    policy.leaseSeconds > QR_GENERATION_DISPATCH_LEASE_SECONDS_MAX
  ) {
    throw new QrGenerationDispatchRuntimeError("INVALID_LEASE_SECONDS");
  }
  if (
    !Number.isInteger(policy.durationBudgetMs) ||
    policy.durationBudgetMs < QR_GENERATION_DISPATCH_DURATION_BUDGET_MS_MIN ||
    policy.durationBudgetMs > QR_GENERATION_DISPATCH_DURATION_BUDGET_MS_MAX
  ) {
    throw new QrGenerationDispatchRuntimeError("INVALID_DURATION_BUDGET");
  }
}

function readClock(clock: () => number): number {
  const value = clock();
  if (!Number.isFinite(value)) {
    throw new QrGenerationDispatchRuntimeError("INVALID_CLOCK");
  }
  return value;
}

function emptyOutcomeCounts(): Record<QrGenerationDispatchOutcomeStatus, number> {
  return {
    DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING: 0,
    DELIVERY_RETRY_SCHEDULED: 0,
    PUBLICATION_ACKNOWLEDGEMENT_PENDING: 0,
    PUBLISHED: 0,
  };
}

function isOutcomeStatus(value: string): value is QrGenerationDispatchOutcomeStatus {
  return OUTCOME_STATUSES.includes(value as QrGenerationDispatchOutcomeStatus);
}

export class BoundedQrGenerationDispatchRuntime {
  constructor(
    private readonly runner: QrGenerationDispatchRunner,
    private readonly policy: QrGenerationDispatchRuntimePolicy,
    private readonly clock: () => number = () => performance.now(),
  ) {
    assertPolicy(policy);
  }

  async run(): Promise<QrGenerationDispatchRuntimeResult> {
    const deadline = readClock(this.clock) + this.policy.durationBudgetMs;
    const outcomeCounts = emptyOutcomeCounts();
    let claimedCount = 0;
    let completedWithinBudget = true;

    while (claimedCount < this.policy.claimLimit) {
      if (readClock(this.clock) >= deadline) {
        completedWithinBudget = false;
        break;
      }

      const result = await this.runner.runOnce({
        leaseSeconds: this.policy.leaseSeconds,
        limit: 1,
      });
      if (result.claimedCount === 0) {
        if (result.outcomes.length !== 0) {
          throw new QrGenerationDispatchRuntimeError("INVALID_RUN_RESULT");
        }
        break;
      }
      if (result.claimedCount !== 1 || result.outcomes.length !== 1) {
        throw new QrGenerationDispatchRuntimeError("INVALID_RUN_RESULT");
      }

      const [outcome] = result.outcomes;
      if (!outcome || !isOutcomeStatus(outcome.status)) {
        throw new QrGenerationDispatchRuntimeError("INVALID_RUN_RESULT");
      }
      claimedCount += 1;
      outcomeCounts[outcome.status] += 1;
    }

    return {
      claimedCount,
      completedWithinBudget,
      outcomeCounts,
    };
  }
}
