import type { AppLocale } from "../i18n/config";

/**
 * Copy for [E], the one screen a scan falls back to when the sticker cannot be
 * used (docs/design-canon/pwa/README.md §4).
 *
 * It never names the site. A revoked sticker must not become a way to find out
 * which site it belonged to. It also carries no retry: the state has to change
 * before the sticker works again, so a retry button would only fail again.
 */
export interface ScanEntryCopy {
  /** Where to go instead. The office is named as a place, not as a phone number. */
  office: string;
  /** Neither repository recognised the token. */
  reasonUnknown: string;
  /** We could not ask. Said as an outage, never as a revoked sticker. */
  reasonService: string;
  title: readonly [string, ...string[]];
}

const ko: ScanEntryCopy = {
  office: "관리사무소에 문의해 주세요.",
  reasonService: "지금은 스티커 상태를 확인할 수 없습니다. 잠시 후 다시 스캔해 주세요.",
  reasonUnknown: "이 스티커는 더 이상 사용되지 않습니다.",
  title: ["사용할 수 없는", "스티커입니다"],
};

const en: ScanEntryCopy = {
  office: "Please contact the management office.",
  reasonService: "We cannot check this sticker right now. Please scan again in a moment.",
  reasonUnknown: "This sticker is no longer in use.",
  title: ["This sticker", "cannot be used"],
};

export const SCAN_ENTRY_COPY: Readonly<Record<AppLocale, ScanEntryCopy>> = Object.freeze({
  en,
  ko,
});
