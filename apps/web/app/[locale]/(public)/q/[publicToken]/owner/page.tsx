import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnerReclaimView } from "../../../../../../components/owner-reclaim-view";
import { OWNER_RECLAIM_COPY } from "../../../../../../content/owner-reclaim-copy";
import { isAppLocale } from "../../../../../../i18n/locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

/**
 * Re-entry lives under the sticker's own URL because it is about this sticker:
 * the owner proves the plate and the phone that this asset is already bound to
 * (docs/design-canon/pwa/README.md §1).
 */
export default async function OwnerReclaimPage({
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
      <OwnerReclaimView
        copy={OWNER_RECLAIM_COPY[locale]}
        locale={locale}
        publicToken={publicToken}
      />
    </main>
  );
}
