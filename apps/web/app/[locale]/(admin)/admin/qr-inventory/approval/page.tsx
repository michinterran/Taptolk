import { notFound, redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../auth/page-guard";
import { isAppLocale } from "../../../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QrInventoryApprovalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    company?: string | string[];
    quantity?: string | string[];
    site?: string | string[];
  }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();

  await requireReadyAdminContext(locale);
  const search = new URLSearchParams();
  const company = readValue(query.company);
  const site = readValue(query.site);
  const quantity = readValue(query.quantity);
  if (company) search.set("company", company);
  if (site) search.set("site", site);
  if (quantity) search.set("quantity", quantity);
  redirect(getLocalizedAdminPath(locale, `/qr-inventory/operations?${search.toString()}`));
  return <main aria-hidden="true" />;
}
