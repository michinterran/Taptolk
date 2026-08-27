import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnerActivationView } from "../../../../../components/owner-activation-view";
import { OWNER_ACTIVATION_COPY } from "../../../../../content/owner-activation-copy";
import { isAppLocale } from "../../../../../i18n/locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function OwnerActivationPage({
  params,
}: {
  params: Promise<{ locale: string; publicToken: string }>;
}) {
  const { locale, publicToken } = await params;
  if (!isAppLocale(locale) || publicToken.length < 16 || publicToken.length > 500) {
    notFound();
  }
  return (
    <main>
      <link rel="manifest" href={`/api/owner/manifest?locale=${locale}`} />
      <OwnerActivationView
        copy={OWNER_ACTIVATION_COPY[locale]}
        locale={locale}
        publicToken={publicToken}
      />
    </main>
  );
}
