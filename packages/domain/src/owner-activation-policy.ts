export const OWNER_OTP_CODE_PATTERN = /^[0-9]{6}$/u;
export const OWNER_PHONE_PATTERN = /^01[016789][0-9]{7,8}$/u;
export const OWNER_VEHICLE_PLATE_PATTERN =
  /^(?=.{5,12}$)[0-9]{2,3}[가-힣][0-9]{4}$|^[가-힣]{2}[0-9]{2}[가-힣][0-9]{4}$/u;
export const OWNER_ACTIVATION_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{8,16}$/u;

export interface OwnerOtpPolicy {
  attemptLimit: number;
  dailyPhoneLimit: number;
  hourlyPhoneLimit: number;
  networkWindowLimit: number;
  proofTtlSeconds: number;
  resendSeconds: number;
  sessionTtlSeconds: number;
  ttlSeconds: number;
}

export const DEFAULT_OWNER_OTP_POLICY: Readonly<OwnerOtpPolicy> = Object.freeze({
  attemptLimit: 5,
  dailyPhoneLimit: 10,
  hourlyPhoneLimit: 5,
  networkWindowLimit: 10,
  proofTtlSeconds: 300,
  resendSeconds: 60,
  sessionTtlSeconds: 43_200,
  ttlSeconds: 180,
});

export type OwnerActivationPolicyErrorCode =
  | "INVALID_ACTIVATION_CODE"
  | "INVALID_CONSENT"
  | "INVALID_DEVICE"
  | "INVALID_OTP"
  | "INVALID_PHONE"
  | "INVALID_PLATE"
  | "INVALID_POLICY";

export class OwnerActivationPolicyError extends Error {
  constructor(readonly code: OwnerActivationPolicyErrorCode) {
    super(`Owner activation policy rejected: ${code}`);
    this.name = "OwnerActivationPolicyError";
  }
}

export function normalizeOwnerPhone(value: string): string {
  const normalized = value.normalize("NFKC").replace(/[\s()-]/gu, "");
  if (!OWNER_PHONE_PATTERN.test(normalized)) {
    throw new OwnerActivationPolicyError("INVALID_PHONE");
  }
  return normalized;
}

export function normalizeOwnerVehiclePlate(value: string): string {
  const normalized = value.normalize("NFKC").replace(/[\s-]/gu, "").toUpperCase();
  if (!OWNER_VEHICLE_PLATE_PATTERN.test(normalized)) {
    throw new OwnerActivationPolicyError("INVALID_PLATE");
  }
  return normalized;
}

export function normalizeOwnerActivationCode(value: string): string {
  const normalized = value.normalize("NFKC").replace(/[\s-]/gu, "").toUpperCase();
  if (!OWNER_ACTIVATION_CODE_PATTERN.test(normalized)) {
    throw new OwnerActivationPolicyError("INVALID_ACTIVATION_CODE");
  }
  return normalized;
}

export function normalizeOwnerOtp(value: string): string {
  const normalized = value.normalize("NFKC").replace(/\s/gu, "");
  if (!OWNER_OTP_CODE_PATTERN.test(normalized)) {
    throw new OwnerActivationPolicyError("INVALID_OTP");
  }
  return normalized;
}

export function assertOwnerConsent(input: {
  accepted: boolean;
  privacyVersion: string;
  termsVersion: string;
}): void {
  if (
    !input.accepted ||
    !/^[A-Z0-9][A-Z0-9._-]{0,31}$/u.test(input.termsVersion) ||
    !/^[A-Z0-9][A-Z0-9._-]{0,31}$/u.test(input.privacyVersion)
  ) {
    throw new OwnerActivationPolicyError("INVALID_CONSENT");
  }
}

export function assertOwnerDeviceId(value: string): void {
  if (!/^[0-9a-f]{64}$/u.test(value)) {
    throw new OwnerActivationPolicyError("INVALID_DEVICE");
  }
}

export function assertOwnerOtpPolicy(policy: OwnerOtpPolicy): void {
  const integerValues = Object.values(policy);
  if (
    integerValues.some((value) => !Number.isInteger(value) || value < 1) ||
    policy.attemptLimit > 10 ||
    policy.hourlyPhoneLimit > policy.dailyPhoneLimit ||
    policy.resendSeconds >= policy.ttlSeconds ||
    policy.proofTtlSeconds > 900 ||
    policy.sessionTtlSeconds > 86_400
  ) {
    throw new OwnerActivationPolicyError("INVALID_POLICY");
  }
}
