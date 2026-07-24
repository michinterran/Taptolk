import { notFound } from "next/navigation";
import { OwnerTabShell } from "../../../../../components/owner-tab-shell";
import { OwnerAlertView } from "../../../../../components/owner-tab-views";
import { OWNER_TABS_COPY } from "../../../../../content/owner-tabs-copy";
import { isAppLocale } from "../../../../../i18n/locale";

export const dynamic = "force-dynamic";

export default async function OwnerAlertPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const copy = OWNER_TABS_COPY[locale];
  return (
    <main>
      <link rel="manifest" href={`/api/owner/manifest?locale=${locale}`} />
      <OwnerTabShell active="alert" copy={copy} locale={locale}>
        <OwnerAlertView copy={copy} locale={locale} />
      </OwnerTabShell>
    </main>
  );
}
