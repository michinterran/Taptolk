import type { AppLocale } from "../i18n/config";

/**
 * The five steps of QR production, in order.
 *
 * Design and brand are one step because both decisions are made against the same
 * live preview — splitting them only added a round trip. Review and production
 * stay in the wizard rather than becoming separate screens: an earlier three-area
 * split was made to fit permissions, and it broke the approved flow. Permission is
 * handled by locking a step, not by moving it.
 *
 * See DESIGN_SYSTEM.md §3.6 and docs/design-canon/console-qr-wizard.html.
 */
export const QR_WIZARD_STEPS = ["site", "design", "quantity", "review", "production"] as const;

export type QrWizardStep = (typeof QR_WIZARD_STEPS)[number];

export type QrWizardStepState = "done" | "current" | "todo" | "locked";

export function isQrWizardStep(value: unknown): value is QrWizardStep {
  return QR_WIZARD_STEPS.includes(value as QrWizardStep);
}

export function getQrWizardStepIndex(step: QrWizardStep): number {
  return QR_WIZARD_STEPS.indexOf(step);
}

/** The step a locale-independent query value resolves to. Unknown values start at the beginning. */
export function resolveQrWizardStep(value: string | undefined): QrWizardStep {
  return isQrWizardStep(value) ? value : "site";
}

/**
 * The chosen site travels with every step link. Without it a later step forgets
 * which site the operator picked and silently falls back to asking again.
 */
export function getQrWizardStepHref(
  locale: AppLocale,
  step: QrWizardStep,
  siteId?: string,
): string {
  const base = `/${locale}/admin/qr-inventory`;
  const query = new URLSearchParams();
  if (step !== "site") {
    query.set("step", step);
  }
  if (siteId) {
    query.set("site", siteId);
  }
  const search = query.toString();
  return search ? `${base}?${search}` : base;
}

export interface QrWizardStepCopy {
  description: string;
  title: string;
}

export function QrWizardStepper({
  current,
  label,
  locale,
  lockedSteps,
  siteId,
  steps,
}: {
  current: QrWizardStep;
  label: string;
  locale: AppLocale;
  /** Steps the signed-in role may not act on. They are shown, dimmed, not hidden. */
  lockedSteps: ReadonlySet<QrWizardStep>;
  siteId?: string | undefined;
  steps: readonly QrWizardStepCopy[];
}) {
  const currentIndex = getQrWizardStepIndex(current);

  return (
    <nav aria-label={label} className="qr-wizard__steps">
      {QR_WIZARD_STEPS.map((step, index) => {
        const copy = steps[index];
        if (!copy) {
          return null;
        }
        const state: QrWizardStepState = lockedSteps.has(step)
          ? "locked"
          : step === current
            ? "current"
            : index < currentIndex
              ? "done"
              : "todo";
        return (
          <a
            aria-current={state === "current" ? "step" : undefined}
            className="qr-wizard__step"
            data-state={state}
            href={getQrWizardStepHref(locale, step, siteId)}
            key={step}
          >
            <span aria-hidden="true" className="qr-wizard__step-marker">
              {state === "done" ? "✓" : index + 1}
            </span>
            <span className="qr-wizard__step-text">
              <strong>{copy.title}</strong>
              <small>{copy.description}</small>
            </span>
          </a>
        );
      })}
    </nav>
  );
}
