import { SemanticHeading } from "@taptolk/ui";
import { notFound } from "next/navigation";
import { OWNER_ACTIVATION_COPY } from "../../../../content/owner-activation-copy";
import { isAppLocale } from "../../../../i18n/locale";

export default async function OwnerOfflinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const copy = OWNER_ACTIVATION_COPY[locale];
  return (
    <main className="owner-activation-shell">
      <section className="owner-activation-card">
        <SemanticHeading className="owner-activation-title" lines={[copy.errorUnavailable]} />
        <p className="owner-activation-description">{copy.description}</p>
      </section>
    </main>
  );
}
