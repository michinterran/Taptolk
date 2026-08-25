"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useRef, useState, useTransition } from "react";

type AsyncActionResult = {
  error?: string;
  status: string;
};

type AsyncAction = (formData: FormData) => Promise<AsyncActionResult>;

export function AdminAsyncActionForm({
  action,
  children,
  className,
  errorMessages,
  successLabel,
}: {
  action: AsyncAction;
  children: ReactNode;
  className: string;
  errorMessages: Readonly<Record<string, string>>;
  successLabel?: string;
}) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const submissionLock = useRef(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) {
      return;
    }

    submissionLock.current = true;
    setActionError(null);
    setSubmitted(false);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result.status === "error") {
          setActionError(result.error ?? "unavailable");
          return;
        }
        setSubmitted(true);
        router.refresh();
      } catch {
        setActionError("unavailable");
      } finally {
        submissionLock.current = false;
      }
    });
  }

  return (
    <form aria-busy={isPending} className={className} onSubmit={handleSubmit}>
      {actionError ? (
        <p className="admin-form-error" role="alert">
          {errorMessages[actionError] ?? errorMessages.unavailable}
        </p>
      ) : null}
      {submitted && successLabel ? (
        <p aria-live="polite" className="admin-notice admin-notice--success" role="status">
          {successLabel}
        </p>
      ) : null}
      {children}
    </form>
  );
}
