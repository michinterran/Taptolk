"use client";

import { type FormEvent, useState, useTransition } from "react";
import { type AdminActionError, type MfaVerificationResult, verifyMfaCode } from "../auth/actions";

interface AdminMfaCodeFormProps {
  codeLabel: string;
  codePlaceholder: string;
  errorMessages: Readonly<Record<AdminActionError, string>>;
  factorId: string;
  locale: string;
  mode: "challenge" | "enroll";
  submitLabel: string;
  workingLabel: string;
}

export function AdminMfaCodeForm({
  codeLabel,
  codePlaceholder,
  errorMessages,
  factorId,
  locale,
  mode,
  submitLabel,
  workingLabel,
}: AdminMfaCodeFormProps) {
  const [result, setResult] = useState<MfaVerificationResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = `admin-mfa-code-${mode}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = formData.get("code");

    startTransition(async () => {
      const verification = await verifyMfaCode(
        locale,
        factorId,
        typeof code === "string" ? code : "",
        mode,
      );
      setResult(verification);
    });
  }

  return (
    <form className="admin-form admin-mfa-form" onSubmit={handleSubmit}>
      <label className="admin-field" htmlFor={inputId}>
        <span>{codeLabel}</span>
        <input
          autoComplete="one-time-code"
          id={inputId}
          inputMode="numeric"
          maxLength={6}
          name="code"
          pattern="[0-9]{6}"
          placeholder={codePlaceholder}
          required
          type="text"
        />
      </label>
      {result && !result.ok ? (
        <p className="admin-form-error" role="alert">
          {errorMessages[result.error]}
        </p>
      ) : null}
      <button className="tt-button admin-submit" disabled={isPending} type="submit">
        {isPending ? workingLabel : submitLabel}
      </button>
    </form>
  );
}
