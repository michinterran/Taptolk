import { createHash, timingSafeEqual } from "node:crypto";

const BEARER_HEADER_PATTERN = /^Bearer ([^\s,]+)$/u;
const INTERNAL_SECRET_MIN_LENGTH = 24;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  expectedSecret: string | undefined,
): boolean {
  if (
    !expectedSecret ||
    expectedSecret.length < INTERNAL_SECRET_MIN_LENGTH ||
    !authorizationHeader
  ) {
    return false;
  }

  const match = BEARER_HEADER_PATTERN.exec(authorizationHeader);
  if (!match?.[1]) {
    return false;
  }

  return timingSafeEqual(digest(match[1]), digest(expectedSecret));
}
