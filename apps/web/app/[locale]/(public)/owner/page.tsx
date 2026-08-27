import { notFound } from "next/navigation";
import { OwnerTabShell } from "../../../../components/owner-tab-shell";
import { OwnerMessagesView } from "../../../../components/owner-tab-views";
import { OWNER_TABS_COPY } from "../../../../content/owner-tabs-copy";
import { isAppLocale } from "../../../../i18n/locale";

export const dynamic = "force-dynamic";

/** MESSAGES is the default tab (docs/design-canon/pwa/README.md §3). */
export default async function OwnerHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const copy = OWNER_TABS_COPY[locale];
  return (
    <main>
      <link rel="manifest" href={`/api/owner/manifest?locale=${locale}`} />
      <OwnerTabShell active="messages" copy={copy} locale={locale}>
        <OwnerMessagesView copy={copy} locale={locale} />
      </OwnerTabShell>
    </main>
  );
}
