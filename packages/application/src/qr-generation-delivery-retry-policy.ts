import type {
  QrGenerationDeliveryRetryPolicy,
  QrGenerationQueuePublishErrorCode,
} from "./qr-generation-dispatch-coordinator.js";
import {
  QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS,
  type QrGenerationDeliveryClaim,
} from "./qr-generation-dispatcher-service.js";

export const QR_GENERATION_DELIVERY_RETRY_DELAY_MIN_MS = 1_000;
export const QR_GENERATION_DELIVERY_RETRY_JITTER_RATIO_MAX = 0.5;

export interface QrGenerationDeliveryRetryPolicyConfig {
  baseDelayMs: number;
  jitterRatio: number;
  maxDelayMs: number;
}

export class QrGenerationDeliveryRetryPolicyError extends Error {
  readonly code:
    | "INVALID_ATTEMPT"
    | "INVALID_BASE_DELAY"
    | "INVALID_CLOCK"
    | "INVALID_JITTER_RATIO"
    | "INVALID_MAX_DELAY"
    | "INVALID_RANDOM_SOURCE";

  constructor(code: QrGenerationDeliveryRetryPolicyError["code"]) {
    super(`QR generation delivery retry policy rejected: ${code}`);
    this.name = "QrGenerationDeliveryRetryPolicyError";
    this.code = code;
  }
}

function validateConfig(config: QrGenerationDeliveryRetryPolicyConfig): void {
  if (
    !Number.isInteger(config.baseDelayMs) ||
    config.baseDelayMs < QR_GENERATION_DELIVERY_RETRY_DELAY_MIN_MS ||
    config.baseDelayMs > QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS
  ) {
    throw new QrGenerationDeliveryRetryPolicyError("INVALID_BASE_DELAY");
  }
  if (
    !Number.isInteger(config.maxDelayMs) ||
    config.maxDelayMs < config.baseDelayMs ||
    config.maxDelayMs > QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS
  ) {
    throw new QrGenerationDeliveryRetryPolicyError("INVALID_MAX_DELAY");
  }
  if (
    !Number.isFinite(config.jitterRatio) ||
    config.jitterRatio < 0 ||
    config.jitterRatio > QR_GENERATION_DELIVERY_RETRY_JITTER_RATIO_MAX
  ) {
    throw new QrGenerationDeliveryRetryPolicyError("INVALID_JITTER_RATIO");
  }
}

function validateAttempt(claim: QrGenerationDeliveryClaim): void {
  if (!Number.isInteger(claim.deliveryAttemptCount) || claim.deliveryAttemptCount < 1) {
    throw new QrGenerationDeliveryRetryPolicyError("INVALID_ATTEMPT");
  }
}

export class ExponentialQrGenerationDeliveryRetryPolicy implements QrGenerationDeliveryRetryPolicy {
  constructor(
    private readonly config: QrGenerationDeliveryRetryPolicyConfig,
    private readonly now: () => Date = () => new Date(),
    private readonly random: () => number = Math.random,
  ) {
    validateConfig(config);
  }

  nextAvailableAt(input: {
    claim: QrGenerationDeliveryClaim;
    errorCode: QrGenerationQueuePublishErrorCode;
  }): string {
    validateAttempt(input.claim);
    const currentTimestamp = this.now().getTime();
    if (!Number.isFinite(currentTimestamp)) {
      throw new QrGenerationDeliveryRetryPolicyError("INVALID_CLOCK");
    }
    const randomValue = this.random();
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue > 1) {
      throw new QrGenerationDeliveryRetryPolicyError("INVALID_RANDOM_SOURCE");
    }

    const exponent = Math.min(input.claim.deliveryAttemptCount - 1, 30);
    const exponentialDelay = Math.min(
      this.config.maxDelayMs,
      this.config.baseDelayMs * 2 ** exponent,
    );
    const jitterRange = exponentialDelay * this.config.jitterRatio;
    const jitteredDelay = exponentialDelay - jitterRange + 2 * jitterRange * randomValue;
    const boundedDelay = Math.min(
      this.config.maxDelayMs,
      Math.max(QR_GENERATION_DELIVERY_RETRY_DELAY_MIN_MS, Math.round(jitteredDelay)),
    );

    return new Date(currentTimestamp + boundedDelay).toISOString();
  }
}
