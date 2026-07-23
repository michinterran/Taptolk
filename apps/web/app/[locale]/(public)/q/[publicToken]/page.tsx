import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublicContactView } from "../../../../../components/public-contact-view";
import { ScanUnusableView } from "../../../../../components/scan-unusable-view";
import { PUBLIC_CONTACT_COPY } from "../../../../../content/public-contact-copy";
import { SCAN_ENTRY_COPY } from "../../../../../content/scan-entry-copy";
import { isAppLocale } from "../../../../../i18n/locale";
import { resolveScanEntry } from "../../../../../scan/scan-entry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

/**
 * The scan entry. One sticker, one URL: the server decides what this scan shows
 * from the asset's state, and the screen never guesses
 * (docs/design-canon/pwa/README.md §1).
 */
export default async function PublicContactPage({
  params,
}: {
  params: Promise<{ locale: string; publicToken: string }>;
}) {
  const { locale, publicToken } = await params;
  if (!isAppLocale(locale) || publicToken.length < 16 || publicToken.length > 500) {
    notFound();
  }
  const entry = await resolveScanEntry(publicToken);
  if (entry.screen === "ACTIVATE") {
    redirect(`/${locale}/activate/${publicToken}`);
  }
  if (entry.screen === "UNUSABLE") {
    return (
      <main>
        <ScanUnusableView copy={SCAN_ENTRY_COPY[locale]} reason={entry.reason} />
      </main>
    );
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
