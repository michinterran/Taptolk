import { normalizeContactMessage } from "./public-contact-policy.js";

export const SMS_PROVIDER_ERROR_CODES = [
  "AUTH_ERROR",
  "INVALID_RECIPIENT",
  "RATE_LIMIT",
  "TEMPORARY_FAILURE",
  "PERMANENT_FAILURE",
  "UNKNOWN",
] as const;

export type SmsProviderErrorCode = (typeof SMS_PROVIDER_ERROR_CODES)[number];

export const OWNER_REPLY_CODES = [
  "MOVING_NOW",
  "MOVE_IN_3_MINUTES",
  "MOVE_IN_5_MINUTES",
  "MOVE_IN_10_MINUTES",
  "CANNOT_MOVE_NOW",
  "CONTACT_SITE_OFFICE",
  "CUSTOM",
] as const;

export type OwnerReplyCode = (typeof OWNER_REPLY_CODES)[number];

export const DEFAULT_NOTIFICATION_RETRY_DELAYS_SECONDS = [30, 120, 300] as const;
export const DEFAULT_RESPONSE_TOKEN_TTL_SECONDS = 3_600;

export class NotificationReplyPolicyError extends Error {
  constructor(
    readonly code:
      | "INVALID_ATTEMPT"
      | "INVALID_OWNER_REPLY"
      | "INVALID_PROVIDER_ERROR"
      | "INVALID_TOKEN_TTL",
  ) {
    super(`Notification reply policy rejected: ${code}`);
    this.name = "NotificationReplyPolicyError";
  }
}

export function isRetryableSmsProviderError(code: string): code is SmsProviderErrorCode {
  if (!SMS_PROVIDER_ERROR_CODES.includes(code as SmsProviderErrorCode)) {
    throw new NotificationReplyPolicyError("INVALID_PROVIDER_ERROR");
  }
  return code === "RATE_LIMIT" || code === "TEMPORARY_FAILURE" || code === "UNKNOWN";
}

export function getNotificationRetryDelaySeconds(
  attempt: number,
  delays: readonly number[] = DEFAULT_NOTIFICATION_RETRY_DELAYS_SECONDS,
): number {
  if (
    !Number.isInteger(attempt) ||
    attempt < 1 ||
    delays.length < 1 ||
    delays.some((delay) => !Number.isInteger(delay) || delay < 1 || delay > 3_600)
  ) {
    throw new NotificationReplyPolicyError("INVALID_ATTEMPT");
  }
  return delays[Math.min(attempt - 1, delays.length - 1)] as number;
}

export function normalizeOwnerReply(input: { body?: string; code: string }): {
  body: string | null;
  code: OwnerReplyCode;
} {
  if (!OWNER_REPLY_CODES.includes(input.code as OwnerReplyCode)) {
    throw new NotificationReplyPolicyError("INVALID_OWNER_REPLY");
  }
  const code = input.code as OwnerReplyCode;
  if (code === "CUSTOM") {
    return {
      body: normalizeContactMessage({ mode: "FREE_TEXT", value: input.body ?? "" }),
      code,
    };
  }
  if (input.body?.trim()) {
    throw new NotificationReplyPolicyError("INVALID_OWNER_REPLY");
  }
  return { body: null, code };
}

export function assertResponseTokenTtl(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds < 300 || seconds > 7_200) {
    throw new NotificationReplyPolicyError("INVALID_TOKEN_TTL");
  }
}
