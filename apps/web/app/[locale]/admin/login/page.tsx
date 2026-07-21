import { notFound } from "next/navigation";
import { AdminLoginScreen } from "../../../../components/admin-login-screen";
import { isAppLocale } from "../../../../i18n/locale";

interface AdminLoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}

export default async function AdminLoginPage({ params, searchParams }: AdminLoginPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <main className="admin-auth-shell">
      <AdminLoginScreen
        locale={locale}
        queryError={Array.isArray(query.error) ? query.error[0] : query.error}
      />
    </main>
  );
}
