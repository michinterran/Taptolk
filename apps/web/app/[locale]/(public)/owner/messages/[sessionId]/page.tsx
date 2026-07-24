import { notFound } from "next/navigation";
import { OwnerTabShell } from "../../../../../../components/owner-tab-shell";
import { OwnerMessageReplyView } from "../../../../../../components/owner-tab-views";
import { OWNER_TABS_COPY } from "../../../../../../content/owner-tabs-copy";
import { isAppLocale } from "../../../../../../i18n/locale";

export const dynamic = "force-dynamic";

export default async function OwnerMessageReplyPage({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { locale, sessionId } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const copy = OWNER_TABS_COPY[locale];
  return (
    <main>
      <link rel="manifest" href={`/api/owner/manifest?locale=${locale}`} />
      <OwnerTabShell active="messages" copy={copy} locale={locale}>
        <OwnerMessageReplyView locale={locale} sessionId={sessionId} />
      </OwnerTabShell>
    </main>
  );
}
