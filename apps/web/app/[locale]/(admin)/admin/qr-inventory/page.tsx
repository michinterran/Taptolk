import { notFound, redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { isAppLocale } from "../../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QrInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();

  const next = new URLSearchParams({ step: readValue(query.step) ?? "site" });
  for (const key of ["error", "site", "status"]) {
    const value = readValue(query[key]);
    if (value) next.set(key, value);
  }
  redirect(getLocalizedAdminPath(locale, `/qr-inventory/approval?${next.toString()}`));
  return <main aria-hidden="true" className="admin-dashboard-shell" />;
}
