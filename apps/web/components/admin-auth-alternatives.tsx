"use client";

import { signInWithGoogle } from "../auth/actions";
import type { AdminRegistrationFlow } from "../auth/registration-routing";
import type { AppLocale } from "../i18n/config";

interface AdminAuthAlternativesProps {
  disabled: boolean;
  dividerLabel: string;
  flow: AdminRegistrationFlow;
  googleLabel: string;
  locale: AppLocale;
  localeTitle: string;
  onSubmitStart?: () => void;
  secondaryAction: string;
  secondaryHref: string;
  secondaryPrompt: string;
}

export function AdminAuthAlternatives({
  disabled,
  dividerLabel,
  flow,
  googleLabel,
  locale,
  localeTitle,
  onSubmitStart,
  secondaryAction,
  secondaryHref,
  secondaryPrompt,
}: AdminAuthAlternativesProps) {
  return (
    <div className="admin-auth-alternatives">
      <div className="admin-auth-divider">
        <span>{dividerLabel}</span>
      </div>
      <form action={signInWithGoogle} onSubmit={onSubmitStart}>
        <input aria-label={googleLabel} name="flow" type="hidden" value={flow} />
        <input aria-label={localeTitle} name="locale" type="hidden" value={locale} />
        <button className="tt-button tt-button--secondary" disabled={disabled} type="submit">
          <span aria-hidden="true" className="admin-google-mark">
            G
          </span>
          {googleLabel}
        </button>
      </form>
      <p className="admin-auth-secondary">
        <span>{secondaryPrompt}</span>
        <a href={secondaryHref}>{secondaryAction}</a>
      </p>
    </div>
  );
}
