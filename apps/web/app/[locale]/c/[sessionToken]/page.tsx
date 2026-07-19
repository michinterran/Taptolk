import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactWaitingRoom } from "../../../../components/contact-waiting-room";
import { PUBLIC_CONTACT_COPY } from "../../../../content/public-contact-copy";
import { isAppLocale } from "../../../../i18n/locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function ContactWaitingPage({
  params,
}: {
  params: Promise<{ locale: string; sessionToken: string }>;
}) {
  const { locale, sessionToken } = await params;
  if (!isAppLocale(locale) || sessionToken !== "current") {
    notFound();
  }
  return (
    <main>
      <ContactWaitingRoom copy={PUBLIC_CONTACT_COPY[locale]} locale={locale} />
    </main>
  );
}
