import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicContactView } from "../../../../../components/public-contact-view";
import { PUBLIC_CONTACT_COPY } from "../../../../../content/public-contact-copy";
import { isAppLocale } from "../../../../../i18n/locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function PublicContactPage({
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
      <PublicContactView
        copy={PUBLIC_CONTACT_COPY[locale]}
        locale={locale}
        publicToken={publicToken}
      />
    </main>
  );
}
