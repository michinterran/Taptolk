"use client";

import { SemanticHeading } from "@taptolk/ui";
import { useParams, usePathname } from "next/navigation";
import { getMessages } from "../../../../content/messages";
import { normalizeLocale } from "../../../../i18n/locale";

export default function AdminError() {
  const params = useParams<{ locale?: string }>();
  const pathname = usePathname();
  const locale = normalizeLocale(params.locale);
  const copy = getMessages(locale);
  const retryPath = pathname ?? `/${locale}/admin/access`;

  return (
    <main className="admin-auth-shell">
      <header className="admin-error-header">
        <a href={`/${locale}/admin/dashboard`} aria-label={copy["admin.brand.logoAlt"]}>
          taptolk
        </a>
        <span>{copy["admin.nav.current"]}</span>
      </header>
      <section className="admin-centered-state" role="alert">
        <p className="eyebrow">{copy["admin.nav.current"]}</p>
        <SemanticHeading className="admin-auth-title" lines={[copy["shared.error.title"]]} />
        <p>{copy["shared.error.description"]}</p>
        <a className="tt-button" href={retryPath}>
          {copy["shared.error.retry"]}
        </a>
      </section>
    </main>
  );
}
