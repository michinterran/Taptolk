import {
  isBusyJourneyState,
  type JourneyState,
  requiresRecoveryAction,
} from "../patterns/journey-state.js";

export interface JourneyStatusProps {
  description: string;
  recovery?: {
    href: string;
    label: string;
  };
  state: JourneyState;
  title: string;
}

export function JourneyStatus({ description, recovery, state, title }: JourneyStatusProps) {
  const recoveryRequired = requiresRecoveryAction(state);

  if (recoveryRequired && !recovery) {
    throw new Error("Error journey states require a recovery action.");
  }

  return (
    <section
      aria-busy={isBusyJourneyState(state)}
      aria-live="polite"
      className="journey-status"
      data-state={state}
      role="status"
    >
      <span aria-hidden="true" className="journey-status__signal" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {recovery ? (
        <a className="tt-button tt-button--compact" href={recovery.href}>
          {recovery.label}
        </a>
      ) : null}
    </section>
  );
}
