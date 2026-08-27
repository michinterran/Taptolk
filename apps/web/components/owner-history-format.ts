import type { AppLocale } from "../i18n/config";

export function formatHistoryResponseDuration(
  seconds: number | null,
  locale: AppLocale,
): string | undefined {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return undefined;
  }
  const wholeSeconds = Math.floor(seconds);
  if (wholeSeconds < 60) {
    return locale === "ko" ? `${wholeSeconds}초` : `${wholeSeconds}s`;
  }
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  if (remainingSeconds === 0) {
    return locale === "ko" ? `${minutes}분` : `${minutes}m`;
  }
  return locale === "ko"
    ? `${minutes}분 ${remainingSeconds}초`
    : `${minutes}m ${remainingSeconds}s`;
}
