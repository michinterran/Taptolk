export const SUPPORTED_LOCALES = ["ko", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_COOKIE_NAME = "taptolk_locale";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const HTML_LANGUAGE_BY_LOCALE: Readonly<Record<AppLocale, string>> = Object.freeze({
  en: "en",
  ko: "ko-KR",
});
