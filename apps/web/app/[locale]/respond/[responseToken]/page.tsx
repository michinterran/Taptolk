import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnerResponseView } from "../../../../components/owner-response-view";
import { OWNER_RESPONSE_COPY } from "../../../../content/owner-response-copy";
import { isAppLocale } from "../../../../i18n/locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
};

export default async function OwnerResponsePage({
  params,
}: {
  params: Promise<{ locale: string; responseToken: string }>;
}) {
  const { locale, responseToken } = await params;
  if (!isAppLocale(locale) || responseToken.length < 32 || responseToken.length > 100) {
    notFound();
  }
  return (
    <main>
      <OwnerResponseView
        copy={OWNER_RESPONSE_COPY[locale]}
        locale={locale}
        responseToken={responseToken}
      />
    </main>
  );
}
