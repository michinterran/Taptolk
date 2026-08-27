"use client";

import { useParams } from "next/navigation";
import { getMessages } from "../../../../content/messages";
import { normalizeLocale } from "../../../../i18n/locale";

export default function AdminLoading() {
  const params = useParams<{ locale?: string }>();
  const copy = getMessages(normalizeLocale(params.locale));

  return (
    <main className="state-page">
      <p aria-live="polite" role="status">
        {copy["shared.loading"]}
      </p>
    </main>
  );
}
