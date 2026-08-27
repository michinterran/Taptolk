"use client";

import { useState } from "react";
import { signInAdmin } from "../auth/actions";
import type { AdminRegistrationFlow } from "../auth/registration-routing";
import type { AppLocale } from "../i18n/config";
import { AdminAuthAlternatives } from "./admin-auth-alternatives";

interface AdminLoginControlsProps {
  controlsDisabled: boolean;
  dividerLabel: string;
  emailLabel: string;
  emailPlaceholder: string;
  googleLabel: string;
  locale: AppLocale;
  localeTitle: string;
  passwordLabel: string;
  secondaryAction: string;
  secondaryHref: string;
  secondaryPrompt: string;
  submitLabel: string;
  workingLabel: string;
}

export function AdminLoginControls({
  controlsDisabled,
  dividerLabel,
  emailLabel,
  emailPlaceholder,
  googleLabel,
  locale,
  localeTitle,
  passwordLabel,
  secondaryAction,
  secondaryHref,
  secondaryPrompt,
  submitLabel,
  workingLabel,
}: AdminLoginControlsProps) {
  const [submitting, setSubmitting] = useState(false);
  const disabled = controlsDisabled || submitting;

  function markSubmitting() {
    setSubmitting(true);
  }

  return (
    <>
      <form
        action={signInAdmin}
        aria-busy={submitting}
        className="admin-form"
        onSubmit={markSubmitting}
      >
        <input aria-label={localeTitle} name="locale" type="hidden" value={locale} />
        <label className="admin-field" htmlFor="admin-email">
          <span>{emailLabel}</span>
          <input
            autoComplete="username"
            disabled={disabled}
            id="admin-email"
            name="email"
            placeholder={emailPlaceholder}
            required
            type="email"
          />
        </label>
        <label className="admin-field" htmlFor="admin-password">
          <span>{passwordLabel}</span>
          <input
            autoComplete="current-password"
            disabled={disabled}
            id="admin-password"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>
        <button className="tt-button admin-submit" disabled={disabled} type="submit">
          {submitting ? workingLabel : submitLabel}
        </button>
      </form>
      <AdminAuthAlternatives
        disabled={disabled}
        dividerLabel={dividerLabel}
        flow={"login" satisfies AdminRegistrationFlow}
        googleLabel={googleLabel}
        locale={locale}
        localeTitle={localeTitle}
        onSubmitStart={markSubmitting}
        secondaryAction={secondaryAction}
        secondaryHref={secondaryHref}
        secondaryPrompt={secondaryPrompt}
      />
    </>
  );
}
