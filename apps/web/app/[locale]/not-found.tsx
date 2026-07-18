"use client";

import { SemanticHeading } from "@taptolk/ui";
import { useParams } from "next/navigation";
import { getMessages } from "../../content/messages";
import { normalizeLocale } from "../../i18n/locale";

export default function NotFound() {
  const params = useParams<{ locale?: string }>();
  const copy = getMessages(normalizeLocale(params.locale));

  return (
    <main className="state-page">
      <SemanticHeading as="h1" lines={[copy["shared.notFound.title"]]} />
      <p>{copy["shared.notFound.description"]}</p>
    </main>
  );
}
