import { type AppLocale, DEFAULT_LOCALE, LOCALE_COOKIE_NAME, SUPPORTED_LOCALES } from "./config";

export interface LocaleDetectionInput {
  acceptLanguage?: string | null;
  cookieLocale?: string | null;
}

interface LanguagePreference {
  language: string;
  quality: number;
  sequence: number;
}

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

function parseAcceptLanguage(header: string): LanguagePreference[] {
  return header
    .split(",")
    .map((part, sequence) => {
      const [rawLanguage, ...parameters] = part.trim().split(";");
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const qualityValue = qualityParameter?.split("=")[1];
      const quality = qualityValue === undefined ? 1 : Number(qualityValue);

      return {
        language: rawLanguage?.trim().toLowerCase() ?? "",
        quality: Number.isFinite(quality) ? quality : 0,
        sequence,
      };
    })
    .filter(({ language, quality }) => language.length > 0 && quality > 0)
    .sort((left, right) => right.quality - left.quality || left.sequence - right.sequence);
}

export function detectLocale({ acceptLanguage, cookieLocale }: LocaleDetectionInput): AppLocale {
  if (isAppLocale(cookieLocale)) {
    return cookieLocale;
  }

  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const preferredLanguage = parseAcceptLanguage(acceptLanguage)[0]?.language;
  return preferredLanguage === "ko" || preferredLanguage?.startsWith("ko-") ? "ko" : DEFAULT_LOCALE;
}

export function getLocaleFromPathname(pathname: string): AppLocale | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isAppLocale(segment) ? segment : null;
}

export function replaceLocaleInPathname(pathname: string, locale: AppLocale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (isAppLocale(segments[0])) {
    segments[0] = locale;
  } else {
    segments.unshift(locale);
  }
  return `/${segments.join("/")}`;
}

export { LOCALE_COOKIE_NAME };
