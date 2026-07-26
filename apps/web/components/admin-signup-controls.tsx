"use client";

import { useState } from "react";
import { signUpAdmin } from "../auth/actions";
import type { AdminRegistrationFlow } from "../auth/registration-routing";
import type { AppLocale } from "../i18n/config";
import { AdminAuthAlternatives } from "./admin-auth-alternatives";

interface AdminSignupControlsProps {
  controlsDisabled: boolean;
  dividerLabel: string;
  emailLabel: string;
  emailPlaceholder: string;
  googleLabel: string;
  locale: AppLocale;
  localeTitle: string;
  passwordConfirmationLabel: string;
  passwordHelp: string;
  passwordLabel: string;
  passwordMinLength: number;
  secondaryAction: string;
  secondaryHref: string;
  secondaryPrompt: string;
  submitLabel: string;
  workingLabel: string;
}

export function AdminSignupControls({
  controlsDisabled,
  dividerLabel,
  emailLabel,
  emailPlaceholder,
  googleLabel,
  locale,
  localeTitle,
  passwordConfirmationLabel,
  passwordHelp,
  passwordLabel,
  passwordMinLength,
  secondaryAction,
  secondaryHref,
  secondaryPrompt,
  submitLabel,
  workingLabel,
}: AdminSignupControlsProps) {
  const [submitting, setSubmitting] = useState(false);
  const disabled = controlsDisabled || submitting;

  function markSubmitting() {
    setSubmitting(true);
  }

  return (
    <>
      <form
        action={signUpAdmin}
        aria-busy={submitting}
        className="admin-form"
        onSubmit={markSubmitting}
      >
        <input aria-label={localeTitle} name="locale" type="hidden" value={locale} />
        <label className="admin-field" htmlFor="admin-signup-email">
          <span>{emailLabel}</span>
          <input
            autoComplete="email"
            disabled={disabled}
            id="admin-signup-email"
            name="email"
            placeholder={emailPlaceholder}
            required
            type="email"
          />
        </label>
        <label className="admin-field" htmlFor="admin-signup-password">
          <span>{passwordLabel}</span>
          <input
            aria-describedby="admin-signup-password-help"
            autoComplete="new-password"
            disabled={disabled}
            id="admin-signup-password"
            maxLength={128}
            minLength={passwordMinLength}
            name="password"
            required
            type="password"
          />
          <small id="admin-signup-password-help">{passwordHelp}</small>
        </label>
        <label className="admin-field" htmlFor="admin-signup-password-confirmation">
          <span>{passwordConfirmationLabel}</span>
          <input
            autoComplete="new-password"
            disabled={disabled}
            id="admin-signup-password-confirmation"
            maxLength={128}
            minLength={passwordMinLength}
            name="passwordConfirmation"
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
        flow={"signup" satisfies AdminRegistrationFlow}
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
