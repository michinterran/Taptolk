"use client";

import type { QrFinalApprovalBatchItem } from "@taptolk/application";
import { useRef, useTransition } from "react";
import { approveQrBatchFinalGeneration } from "../admin/qr-final-generation-approval-actions";
import type { AppLocale } from "../i18n/config";

interface QrOnlyApprovalFormProps {
  batch: QrFinalApprovalBatchItem;
  approve: string;
  locale: AppLocale;
  pendingLabel: string;
  reason: string;
  reasonPlaceholder: string;
  title: string;
}

export function QrOnlyApprovalForm({
  approve,
  batch,
  locale,
  pendingLabel,
  reason,
  reasonPlaceholder,
  title,
}: QrOnlyApprovalFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="admin-catalog-card__form"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !formRef.current) return;
        const formData = new FormData(formRef.current);
        startTransition(() => {
          void approveQrBatchFinalGeneration(formData);
        });
      }}
      ref={formRef}
    >
      <input aria-label={title} name="locale" type="hidden" value={locale} />
      <input aria-label={title} name="batchId" type="hidden" value={batch.id} />
      <input aria-label={title} name="expectedBatchVersion" type="hidden" value={batch.version} />
      <input aria-label={title} name="requestId" type="hidden" value={crypto.randomUUID()} />
      <label className="admin-field" htmlFor={`qr-approval-reason-${batch.id}`}>
        <span>{reason}</span>
        <input
          defaultValue={reasonPlaceholder}
          id={`qr-approval-reason-${batch.id}`}
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder={reasonPlaceholder}
          required
        />
      </label>
      <button className="tt-button" disabled={pending} type="submit">
        {pending ? pendingLabel : approve}
      </button>
    </form>
  );
}
