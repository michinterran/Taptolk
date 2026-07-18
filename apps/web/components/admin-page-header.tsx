import type { AppLocale } from "../i18n/config";
import { LocaleSwitcher } from "./locale-switcher";

interface AdminPageHeaderProps {
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  pathname: string;
}

export function AdminPageHeader({
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  pathname,
}: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      <a className="admin-brand-link" href={`/${locale}`}>
        {/* biome-ignore lint/performance/noImgElement: approved logo must bypass image transformation */}
        <img
          alt={logoAlt}
          className="admin-brand-logo"
          height="405"
          src="/brand/taptolk-logo.png"
          width="1000"
        />
      </a>
      <LocaleSwitcher
        currentLocale={locale}
        labels={localeLabels}
        pathname={pathname}
        title={localeTitle}
      />
    </header>
  );
}
