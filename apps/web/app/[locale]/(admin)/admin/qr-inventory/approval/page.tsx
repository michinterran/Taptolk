import { notFound, redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { isAppLocale } from "../../../../../../i18n/locale";

/**
 * The former sticker-design approval wizard is retained as a compatibility URL only.
 * New QR issuance is QR-only: scope → quantity → dynamic QR generation → SVG download.
 */
export default async function QrInventoryApprovalCompatibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  redirect(getLocalizedAdminPath(locale, "/qr-inventory"));
  return <main aria-hidden="true" className="admin-dashboard-shell" />;
}
