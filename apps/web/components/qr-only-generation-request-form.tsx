"use client";

import { type ReactNode, useRef, useTransition } from "react";
import { requestQrOnlyGeneration } from "../admin/qr-only-generation-actions";
import type { AppLocale } from "../i18n/config";

interface QrOnlyGenerationRequestFormProps {
  children: ReactNode;
  companyId: string;
  expectedSiteVersion: number;
  idempotencyKey: string;
  locale: AppLocale;
  pendingLabel: string;
  quantity: number;
  reason: string;
  siteId: string;
  title: string;
}

export function QrOnlyGenerationRequestForm({
  children,
  companyId,
  expectedSiteVersion,
  idempotencyKey,
  locale,
  pendingLabel,
  quantity,
  reason,
  siteId,
  title,
}: QrOnlyGenerationRequestFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="qr-console-v2-review"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !formRef.current) return;
        const formData = new FormData(formRef.current);
        startTransition(() => {
          void requestQrOnlyGeneration(formData);
        });
      }}
      ref={formRef}
    >
      <input aria-label={title} name="locale" type="hidden" value={locale} />
      <input aria-label={title} name="companyId" type="hidden" value={companyId} />
      <input aria-label={title} name="siteId" type="hidden" value={siteId} />
      <input
        aria-label={title}
        name="expectedSiteVersion"
        type="hidden"
        value={expectedSiteVersion}
      />
      <input aria-label={title} name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <input aria-label={title} name="quantity" type="hidden" value={quantity} />
      <input aria-label={title} name="reason" type="hidden" value={reason} />
      {children}
      {pending ? (
        <span aria-live="polite" className="qr-console-v2-help">
          {pendingLabel}
        </span>
      ) : null}
    </form>
  );
}
