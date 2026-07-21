import { notFound } from "next/navigation";
import { OwnerHomeView } from "../../../../components/owner-home-view";
import { OWNER_ACTIVATION_COPY } from "../../../../content/owner-activation-copy";
import { isAppLocale } from "../../../../i18n/locale";

export default async function OwnerHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const copy = OWNER_ACTIVATION_COPY[locale];
  return (
    <main className="owner-activation-shell">
      <link rel="manifest" href={`/api/owner/manifest?locale=${locale}`} />
      <OwnerHomeView copy={copy} locale={locale} />
    </main>
  );
}
