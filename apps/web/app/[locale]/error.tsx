"use client";

import { Button, SemanticHeading } from "@taptolk/ui";
import { useParams } from "next/navigation";
import { getMessages } from "../../content/messages";
import { normalizeLocale } from "../../i18n/locale";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale?: string }>();
  const copy = getMessages(normalizeLocale(params.locale));

  return (
    <main className="state-page">
      <SemanticHeading as="h1" lines={[copy["shared.error.title"]]} />
      <p>{copy["shared.error.description"]}</p>
      <Button onClick={reset}>{copy["shared.error.retry"]}</Button>
    </main>
  );
}
