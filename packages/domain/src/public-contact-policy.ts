export const CONTACT_REASON_CODES = [
  "MOVE_REQUEST",
  "EXIT_BLOCKED",
  "DOUBLE_PARKED",
  "VEHICLE_NOT_MOVING",
  "LIGHT_ON",
  "WINDOW_OPEN",
  "VEHICLE_DAMAGE",
  "ACCIDENT_CONTACT",
  "OTHER",
] as const;

export type ContactReasonCode = (typeof CONTACT_REASON_CODES)[number];
export type ContactMessageMode = "FREE_TEXT" | "TEMPLATE";

export const PUBLIC_CONTACT_TERMINAL_STATUSES = [
  "BLOCKED",
  "CANCELLED",
  "EXPIRED",
  "RESOLVED",
] as const;

export type PublicContactStatus =
  | "BLOCKED"
  | "CALLER_VIEWED"
  | "CANCELLED"
  | "ESCALATED"
  | "EXPIRED"
  | "NOTIFICATION_FAILED"
  | "NOTIFICATION_QUEUED"
  | "OWNER_NOTIFIED"
  | "OWNER_REPLIED"
  | "OWNER_VIEWED"
  | "RESOLVED";

export interface PublicContactRatePolicy {
  anonymousGlobalLimit: number;
  anonymousGlobalWindowSeconds: number;
  duplicateMergeSeconds: number;
  ipQrLimit: number;
  ipQrWindowSeconds: number;
  qrGlobalLimit: number;
  qrGlobalWindowSeconds: number;
  sessionTtlSeconds: number;
}

export const DEFAULT_PUBLIC_CONTACT_RATE_POLICY: Readonly<PublicContactRatePolicy> = Object.freeze({
  anonymousGlobalLimit: 5,
  anonymousGlobalWindowSeconds: 600,
  duplicateMergeSeconds: 180,
  ipQrLimit: 3,
  ipQrWindowSeconds: 600,
  qrGlobalLimit: 5,
  qrGlobalWindowSeconds: 60,
  sessionTtlSeconds: 3_600,
});

export type PublicContactPolicyErrorCode =
  | "CONTACT_MESSAGE_BLOCKED"
  | "CONTACT_MESSAGE_EMPTY"
  | "CONTACT_MESSAGE_TOO_LONG"
  | "INVALID_CONTACT_POLICY"
  | "INVALID_CONTACT_REASON"
  | "INVALID_PLATE_CONFIRMATION";

export class PublicContactPolicyError extends Error {
  constructor(readonly code: PublicContactPolicyErrorCode) {
    super(`Public contact policy rejected: ${code}`);
    this.name = "PublicContactPolicyError";
  }
}

const URL_PATTERN = /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+(?:com|net|org|kr|io|co|app)\b)/iu;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/iu;
const PHONE_PATTERN = /(?:\+?82[-\s]?)?0?1[016789](?:[-\s]?[0-9]){7,8}/u;
const THREAT_PATTERN = /(?:죽여|살해|협박|폭파|스토킹|보복|찾아간다)/u;
const REPEATED_CHARACTER_PATTERN = /(.)\1{19,}/u;

export function normalizeContactReason(value: string): ContactReasonCode {
  if (!CONTACT_REASON_CODES.includes(value as ContactReasonCode)) {
    throw new PublicContactPolicyError("INVALID_CONTACT_REASON");
  }
  return value as ContactReasonCode;
}

export function normalizeContactMessage(input: {
  mode: ContactMessageMode;
  value: string;
}): string {
  const normalized = input.value
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .replace(/[^\S\n]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  if (!normalized) {
    throw new PublicContactPolicyError("CONTACT_MESSAGE_EMPTY");
  }
  if ([...normalized].length > 200) {
    throw new PublicContactPolicyError("CONTACT_MESSAGE_TOO_LONG");
  }
  if (
    URL_PATTERN.test(normalized) ||
    EMAIL_PATTERN.test(normalized) ||
    PHONE_PATTERN.test(normalized) ||
    THREAT_PATTERN.test(normalized) ||
    REPEATED_CHARACTER_PATTERN.test(normalized)
  ) {
    throw new PublicContactPolicyError("CONTACT_MESSAGE_BLOCKED");
  }
  return normalized;
}

export function assertContactPlateLast4(value: string): void {
  if (!/^[0-9]{4}$/u.test(value)) {
    throw new PublicContactPolicyError("INVALID_PLATE_CONFIRMATION");
  }
}

export function assertPublicContactRatePolicy(policy: PublicContactRatePolicy): void {
  const values = Object.values(policy);
  if (
    values.some((value) => !Number.isInteger(value) || value < 1) ||
    policy.anonymousGlobalLimit > 20 ||
    policy.ipQrLimit > policy.anonymousGlobalLimit ||
    policy.qrGlobalLimit > 20 ||
    policy.duplicateMergeSeconds > policy.anonymousGlobalWindowSeconds ||
    policy.qrGlobalWindowSeconds > policy.ipQrWindowSeconds ||
    policy.sessionTtlSeconds > 86_400
  ) {
    throw new PublicContactPolicyError("INVALID_CONTACT_POLICY");
  }
}

export function getPublicContactPollingInterval(input: {
  elapsedSeconds: number;
  hidden: boolean;
  networkFailures?: number;
  status: PublicContactStatus;
}): number | null {
  if (
    PUBLIC_CONTACT_TERMINAL_STATUSES.includes(
      input.status as (typeof PUBLIC_CONTACT_TERMINAL_STATUSES)[number],
    )
  ) {
    return null;
  }
  if (!Number.isFinite(input.elapsedSeconds) || input.elapsedSeconds < 0) {
    throw new PublicContactPolicyError("INVALID_CONTACT_POLICY");
  }
  const base = input.hidden
    ? 15_000
    : input.elapsedSeconds < 120
      ? 3_000
      : input.elapsedSeconds < 300
        ? 5_000
        : 10_000;
  const failures = Math.min(Math.max(input.networkFailures ?? 0, 0), 3);
  return Math.min(base * 2 ** failures, 30_000);
}
