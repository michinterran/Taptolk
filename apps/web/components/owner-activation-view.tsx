"use client";

import { SemanticHeading } from "@taptolk/ui";
import { useEffect, useState } from "react";
import type { OwnerActivationCopy } from "../content/owner-activation-copy";
import type { AppLocale } from "../i18n/config";
import { getOwnerDeviceHash } from "../owner/owner-device-client";

type Step = "CONSENT" | "DETAILS" | "INSPECTING" | "OTP" | "SUCCESS";
type ErrorCode = "CONFLICT" | "INVALID" | "LIMITED" | "UNAVAILABLE" | null;

interface OwnerActivationViewProps {
  copy: OwnerActivationCopy;
  locale: AppLocale;
  publicToken: string;
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

export function OwnerActivationView({ copy, locale, publicToken }: OwnerActivationViewProps) {
  const [step, setStep] = useState<Step>("INSPECTING");
  const [error, setError] = useState<ErrorCode>(null);
  const [working, setWorking] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [proof, setProof] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [otp, setOtp] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [plateLast4, setPlateLast4] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/owner-sw.js", { scope: "/" });
    }
    let active = true;
    void postJson("/api/owner/activation/inspect", { locale, publicToken })
      .then((payload) => {
        if (active) {
          const maskedPlate = payload.data.plateLast4;
          setPlateLast4(typeof maskedPlate === "string" ? maskedPlate : "");
          setStep("DETAILS");
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(mapError(reason));
          setStep("DETAILS");
        }
      });
    return () => {
      active = false;
    };
  }, [locale, publicToken]);

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

  async function requestOtp() {
    setWorking(true);
    setError(null);
    try {
      const hash = await getOwnerDeviceHash();
      const payload = await postJson("/api/owner/activation/request-otp", {
        deviceHash: hash,
        locale,
        phone,
        publicToken,
      });
      const nextChallengeId = payload.data.challengeId;
      if (typeof nextChallengeId !== "string") {
        throw new Error("UNAVAILABLE");
      }
      setChallengeId(nextChallengeId);
      setStep("OTP");
    } catch (reason) {
      setError(mapError(reason));
    } finally {
      setWorking(false);
    }
  }

  async function verifyOtp() {
    setWorking(true);
    setError(null);
    try {
      const payload = await postJson("/api/owner/activation/verify-otp", {
        challengeId,
        locale,
        otp,
        publicToken,
      });
      const nextProof = payload.data.proof;
      if (typeof nextProof !== "string") {
        throw new Error("UNAVAILABLE");
      }
      setProof(nextProof);
      setOtp("");
      setStep("CONSENT");
    } catch (reason) {
      setError(mapError(reason));
    } finally {
      setWorking(false);
    }
  }

  async function completeActivation() {
    setWorking(true);
    setError(null);
    try {
      await postJson("/api/owner/activation/complete", {
        activationCode,
        consentAccepted,
        deviceHash: await getOwnerDeviceHash(),
        locale,
        plate,
        privacyVersion: "PRIVACY_V1",
        proof,
        publicToken,
        termsVersion: "TERMS_V1",
      });
      setActivationCode("");
      setPhone("");
      setPlate("");
      setProof("");
      setStep("SUCCESS");
    } catch (reason) {
      setError(mapError(reason));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="owner-activation-shell">
      <header className="owner-activation-header">
        {/* Immutable deployable logo copy; WCJ verifies source checksum. */}
        {/* biome-ignore lint/performance/noImgElement: the immutable logo must be served byte-for-byte */}
        <img className="owner-activation-logo" src="/brand/taptolk-logo.png" alt="Taptolk" />
        <span className="owner-activation-locale">{locale.toUpperCase()}</span>
      </header>

      <section className="owner-activation-card" aria-live="polite">
        <p className="eyebrow">{copy.inspect}</p>
        <SemanticHeading className="owner-activation-title" lines={[copy.line1, copy.line2]} />
        <p className="owner-activation-description">{copy.description}</p>

        {step === "INSPECTING" ? <p className="owner-activation-notice">{copy.loading}</p> : null}

        {errorMessage ? (
          <p className="owner-activation-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {step === "DETAILS" ? (
          <form
            className="owner-activation-form"
            onSubmit={(event) => {
              event.preventDefault();
              void requestOtp();
            }}
          >
            <label htmlFor="owner-activation-code">
              <span className="owner-activation-label">{copy.activationCode}</span>
              <input
                autoComplete="one-time-code"
                id="owner-activation-code"
                required
                value={activationCode}
                onChange={(event) => setActivationCode(event.target.value)}
              />
              <small>{copy.activationCodeHint}</small>
            </label>
            <label htmlFor="owner-vehicle-plate">
              <span className="owner-activation-label">{copy.plate}</span>
              <input
                autoCapitalize="characters"
                id="owner-vehicle-plate"
                required
                value={plate}
                onChange={(event) => setPlate(event.target.value)}
              />
              <small>
                {plateLast4 ? `${copy.plateHint} · •••• ${plateLast4}` : copy.plateHint}
              </small>
            </label>
            <label htmlFor="owner-phone">
              <span className="owner-activation-label">{copy.phone}</span>
              <input
                autoComplete="tel"
                id="owner-phone"
                inputMode="tel"
                required
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
              <small>{copy.phoneHint}</small>
            </label>
            <button className="owner-activation-primary" disabled={working} type="submit">
              {copy.next}
            </button>
          </form>
        ) : null}

        {step === "OTP" ? (
          <form
            className="owner-activation-form"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyOtp();
            }}
          >
            <label htmlFor="owner-otp">
              <span className="owner-activation-label">{copy.otp}</span>
              <input
                autoComplete="one-time-code"
                id="owner-otp"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
              />
              <small>{copy.otpHint}</small>
            </label>
            <button className="owner-activation-primary" disabled={working} type="submit">
              {copy.verify}
            </button>
            <button
              type="button"
              className="owner-activation-secondary"
              disabled={working}
              onClick={() => void requestOtp()}
            >
              {copy.resend}
            </button>
            <button
              type="button"
              className="owner-activation-link"
              onClick={() => setStep("DETAILS")}
            >
              {copy.back}
            </button>
          </form>
        ) : null}

        {step === "CONSENT" ? (
          <div className="owner-activation-form">
            <label className="owner-activation-consent" htmlFor="owner-activation-consent">
              <input
                aria-label={copy.consent}
                checked={consentAccepted}
                id="owner-activation-consent"
                onChange={(event) => setConsentAccepted(event.target.checked)}
                type="checkbox"
              />
              <span>{copy.consent}</span>
            </label>
            <p className="owner-activation-help">{copy.consentDescription}</p>
            <button
              type="button"
              className="owner-activation-primary"
              disabled={!consentAccepted || working}
              onClick={() => void completeActivation()}
            >
              {copy.submit}
            </button>
          </div>
        ) : null}

        {step === "SUCCESS" ? (
          <div className="owner-activation-success">
            <span aria-hidden="true">✓</span>
            <h2>{copy.successTitle}</h2>
            <p>{copy.successDescription}</p>
            <a
              className="owner-activation-primary owner-activation-home-link"
              href={`/${locale}/owner`}
            >
              {copy.openOwner}
            </a>
          </div>
        ) : null}

        <p className="owner-activation-security">{copy.security}</p>
      </section>
    </div>
  );
}
