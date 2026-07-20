import { notFound } from "next/navigation";
import { AdminLoginScreen } from "../../../../../components/admin-login-screen";
import { isAppLocale } from "../../../../../i18n/locale";

interface PlatformLoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}

export default async function PlatformLoginPage({ params, searchParams }: PlatformLoginPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <main className="admin-auth-shell">
      <AdminLoginScreen
        area="platform"
        locale={locale}
        queryError={Array.isArray(query.error) ? query.error[0] : query.error}
      />
    </main>
  );
}
