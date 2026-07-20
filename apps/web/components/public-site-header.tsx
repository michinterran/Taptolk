import type { AppLocale } from "../i18n/config";
import { LocaleSwitcher } from "./locale-switcher";

interface PublicSiteHeaderProps {
  currentLocale: AppLocale;
  labels: Readonly<{
    customerAdmin: string;
    en: string;
    guide: string;
    ko: string;
    navigation: string;
    platformAdmin: string;
  }>;
  localeTitle: string;
  logoAlt: string;
  pathname: string;
}

export function PublicSiteHeader({
  currentLocale,
  labels,
  localeTitle,
  logoAlt,
  pathname,
}: PublicSiteHeaderProps) {
  return (
    <header className="public-site-header">
      <a className="public-site-brand" href={`/${currentLocale}`}>
        {/* biome-ignore lint/performance/noImgElement: approved logo must bypass image transformation */}
        <img alt={logoAlt} height="405" src="/brand/taptolk-logo.png" width="1000" />
      </a>
      <div className="public-site-header__controls">
        <nav aria-label={labels.navigation} className="public-site-nav">
          <a href={`/${currentLocale}/onboarding`}>{labels.guide}</a>
          <a href={`/${currentLocale}/admin/login`}>{labels.customerAdmin}</a>
          <a href={`/${currentLocale}/admin/platform/login`}>{labels.platformAdmin}</a>
        </nav>
        <LocaleSwitcher
          currentLocale={currentLocale}
          labels={{ en: labels.en, ko: labels.ko }}
          pathname={pathname}
          title={localeTitle}
        />
      </div>
    </header>
  );
}
