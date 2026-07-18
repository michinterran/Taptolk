"use client";

import { useState, useTransition } from "react";
import {
  type AdminActionError,
  type MfaEnrollmentResult,
  startMfaEnrollment,
} from "../auth/actions";
import { AdminMfaCodeForm } from "./admin-mfa-code-form";

interface AdminMfaEnrollmentProps {
  beginLabel: string;
  codeLabel: string;
  codePlaceholder: string;
  errorMessages: Readonly<Record<AdminActionError, string>>;
  locale: string;
  qrAlt: string;
  secretHelp: string;
  secretLabel: string;
  submitLabel: string;
  workingLabel: string;
}

export function AdminMfaEnrollment({
  beginLabel,
  codeLabel,
  codePlaceholder,
  errorMessages,
  locale,
  qrAlt,
  secretHelp,
  secretLabel,
  submitLabel,
  workingLabel,
}: AdminMfaEnrollmentProps) {
  const [enrollment, setEnrollment] = useState<MfaEnrollmentResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function beginEnrollment() {
    startTransition(async () => {
      setEnrollment(await startMfaEnrollment(locale));
    });
  }

  if (!enrollment || enrollment.status === "ERROR") {
    return (
      <div className="admin-enrollment-start">
        {enrollment?.status === "ERROR" ? (
          <p className="admin-form-error" role="alert">
            {errorMessages[enrollment.error]}
          </p>
        ) : null}
        <button
          className="tt-button admin-submit"
          disabled={isPending}
          onClick={beginEnrollment}
          type="button"
        >
          {isPending ? workingLabel : beginLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="admin-enrollment">
      <div className="admin-enrollment-qr">
        {/* biome-ignore lint/performance/noImgElement: Supabase returns an ephemeral SVG data URL */}
        <img alt={qrAlt} height="240" src={enrollment.qrCode} width="240" />
      </div>
      <div className="admin-enrollment-secret">
        <strong>{secretLabel}</strong>
        <code>{enrollment.secret}</code>
        <p>{secretHelp}</p>
      </div>
      <AdminMfaCodeForm
        codeLabel={codeLabel}
        codePlaceholder={codePlaceholder}
        errorMessages={errorMessages}
        factorId={enrollment.factorId}
        locale={locale}
        mode="enroll"
        submitLabel={submitLabel}
        workingLabel={workingLabel}
      />
    </div>
  );
}
