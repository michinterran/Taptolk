"use client";

import { SemanticHeading } from "@taptolk/ui";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { PublicContactCopy } from "../content/public-contact-copy";
import type { AppLocale } from "../i18n/config";

type Step = "CONFIRM" | "INSPECTING" | "REASON" | "REVIEW" | "VEHICLE";
type ErrorCode = "CONFLICT" | "INVALID" | "LIMITED" | "UNAVAILABLE" | null;

interface PublicContactViewProps {
  copy: PublicContactCopy;
  locale: AppLocale;
  /** Localized "Are you the owner of this vehicle?" — owned by the reclaim catalog. */
  ownerEntryLink: string;
  publicToken: string;
}

interface PublicQrData {
  siteDisplayName: string;
  vehicle: {
    plateLast4: string;
  };
}

async function postJson(path: string, body: Readonly<Record<string, unknown>>) {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const code =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { code?: string } }).error?.code
        : undefined;
    throw new Error(code ?? "UNAVAILABLE");
  }
  return payload as { data: Record<string, unknown> };
}

function mapError(error: unknown): ErrorCode {
  if (!(error instanceof Error)) {
    return "UNAVAILABLE";
  }
  if (error.message === "LIMITED") {
    return "LIMITED";
  }
  if (error.message === "CONFLICT") {
    return "CONFLICT";
  }
  if (error.message === "INVALID" || error.message === "VALIDATION") {
    return "INVALID";
  }
  return "UNAVAILABLE";
}

export function PublicContactView({
  copy,
  locale,
  ownerEntryLink,
  publicToken,
}: PublicContactViewProps) {
  const [step, setStep] = useState<Step>("INSPECTING");
  const [error, setError] = useState<ErrorCode>(null);
  const [working, setWorking] = useState(false);
  const [qr, setQr] = useState<PublicQrData | null>(null);
  const [reasonCode, setReasonCode] = useState<keyof typeof copy.reasonLabels>("MOVE_REQUEST");
  const [freeMessage, setFreeMessage] = useState("");

  useEffect(() => {
    let active = true;
    void postJson("/api/public/qr/inspect", { locale, publicToken })
      .then((payload) => {
        const vehicle = payload.data.vehicle;
        const siteDisplayName = payload.data.siteDisplayName;
        if (
          active &&
          vehicle &&
          typeof vehicle === "object" &&
          typeof (vehicle as { plateLast4?: unknown }).plateLast4 === "string" &&
          typeof siteDisplayName === "string"
        ) {
          setQr({
            siteDisplayName,
            vehicle: { plateLast4: (vehicle as { plateLast4: string }).plateLast4 },
          });
          setStep("VEHICLE");
          return;
        }
        throw new Error("UNAVAILABLE");
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(mapError(reason));
          setStep("VEHICLE");
        }
      });
    return () => {
      active = false;
    };
  }, [locale, publicToken]);

  const message = reasonCode === "OTHER" ? freeMessage : copy.templateMessages[reasonCode];
  const errorMessage =
    error === "CONFLICT"
      ? copy.errorConflict
      : error === "LIMITED"
        ? copy.errorLimited
        : error === "INVALID"
          ? copy.errorInvalid
          : error
            ? copy.errorUnavailable
            : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!qr) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await postJson("/api/public/contact-sessions", {
        locale,
        message,
        messageMode: reasonCode === "OTHER" ? "FREE_TEXT" : "TEMPLATE",
        plateLast4: qr.vehicle.plateLast4,
        publicToken,
        reasonCode,
      });
      window.location.assign(`/${locale}/c/current`);
    } catch (reason) {
      setError(mapError(reason));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="public-contact-shell">
      <header className="public-contact-header">
        {/* biome-ignore lint/performance/noImgElement: immutable logo must be byte-for-byte */}
        <img className="public-contact-logo" src="/brand/taptolk-logo.png" alt="Taptolk" />
        <span className="public-contact-locale">{locale.toUpperCase()}</span>
      </header>

      <section className="public-contact-card" aria-live="polite">
        <p className="eyebrow">{copy.inspectLabel}</p>
        <SemanticHeading className="public-contact-title" lines={[copy.line1, copy.line2]} />
        <p className="public-contact-description">{copy.description}</p>

        {step === "INSPECTING" ? <p className="public-contact-notice">{copy.loading}</p> : null}
        {errorMessage ? (
          <div className="public-contact-error" role="alert">
            <p>{errorMessage}</p>
            <button type="button" onClick={() => window.location.reload()}>
              {copy.retry}
            </button>
          </div>
        ) : null}

        {step === "VEHICLE" && qr ? (
          <div className="public-contact-step">
            <h2>{copy.vehicleTitle}</h2>
            <p>{copy.vehicleDescription}</p>
            <div className="public-contact-vehicle">
              <strong>•••• {qr.vehicle.plateLast4}</strong>
              <span>
                {copy.siteLabel} · {qr.siteDisplayName}
              </span>
            </div>
            <p className="public-contact-privacy">{copy.ownerPrivacy}</p>
            <button
              className="public-contact-primary"
              type="button"
              onClick={() => setStep("REASON")}
            >
              {copy.vehicleConfirm}
            </button>
          </div>
        ) : null}

        {step === "REASON" ? (
          <div className="public-contact-step">
            <h2>{copy.reasonTitle}</h2>
            <p>{copy.reasonDescription}</p>
            <div className="public-contact-reasons">
              {Object.entries(copy.reasonLabels).map(([code, label]) => (
                <button
                  className={reasonCode === code ? "is-selected" : undefined}
                  key={code}
                  type="button"
                  onClick={() => {
                    setReasonCode(code as keyof typeof copy.reasonLabels);
                    setStep(code === "OTHER" ? "CONFIRM" : "REVIEW");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="public-contact-link"
              type="button"
              onClick={() => setStep("VEHICLE")}
            >
              {copy.back}
            </button>
          </div>
        ) : null}

        {step === "CONFIRM" ? (
          <form
            className="public-contact-step"
            onSubmit={(event) => {
              event.preventDefault();
              setStep("REVIEW");
            }}
          >
            <label htmlFor="public-contact-message">{copy.freeMessage}</label>
            <textarea
              id="public-contact-message"
              maxLength={200}
              required
              value={freeMessage}
              onChange={(event) => setFreeMessage(event.target.value)}
            />
            <small>{copy.freeMessageHint}</small>
            <button className="public-contact-primary" type="submit">
              {copy.confirmTitle}
            </button>
            <button className="public-contact-link" type="button" onClick={() => setStep("REASON")}>
              {copy.back}
            </button>
          </form>
        ) : null}

        {step === "REVIEW" ? (
          <form className="public-contact-step" onSubmit={(event) => void submit(event)}>
            <h2>{copy.confirmTitle}</h2>
            <p>{copy.confirmDescription}</p>
            <blockquote>{message}</blockquote>
            <button className="public-contact-primary" disabled={working} type="submit">
              {working ? copy.preparing : copy.send}
            </button>
            <button className="public-contact-link" type="button" onClick={() => setStep("REASON")}>
              {copy.back}
            </button>
          </form>
        ) : null}

        <p className="public-contact-security">{copy.security}</p>
      </section>

      {/* The owner whose phone changed lands here on their own sticker, because
          this device has no owner session. This is the way back
          (docs/design-canon/pwa/README.md §1). */}
      <a className="public-contact-link" href={`/${locale}/q/${publicToken}/owner`}>
        {ownerEntryLink}
      </a>
    </div>
  );
}
