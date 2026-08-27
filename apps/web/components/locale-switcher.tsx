import type { AppLocale } from "../i18n/config";
import { SUPPORTED_LOCALES } from "../i18n/config";
import { replaceLocaleInPathname } from "../i18n/locale";

const SHORT_LABELS: Readonly<Record<AppLocale, string>> = Object.freeze({
  en: "ENG",
  ko: "KO",
});

export interface LocaleSwitcherProps {
  currentLocale: AppLocale;
  labels: Readonly<Record<AppLocale, string>>;
  pathname: string;
  title: string;
}

export function LocaleSwitcher({ currentLocale, labels, pathname, title }: LocaleSwitcherProps) {
  return (
    <nav aria-label={title} className="locale-switcher">
      {SUPPORTED_LOCALES.map((locale) => {
        const returnTo = replaceLocaleInPathname(pathname, locale);
        const href = `/api/locale?locale=${locale}&returnTo=${encodeURIComponent(returnTo)}`;

        return (
          <a
            aria-current={locale === currentLocale ? "page" : undefined}
            aria-label={labels[locale]}
            className="locale-switcher__option"
            href={href}
            key={locale}
            lang={locale}
          >
            {SHORT_LABELS[locale]}
          </a>
        );
      })}
    </nav>
  );
}
