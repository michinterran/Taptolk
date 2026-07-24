"use client";

import {
  MobileActions,
  MobileCard,
  MobileField,
  MobileLink,
  MobileNotice,
  MobilePrimary,
  MobileQuietButton,
  MobileSecondary,
  MobileShell,
  Plate,
  SemanticHeading,
} from "@taptolk/ui";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { OwnerActivationCopy } from "../content/owner-activation-copy";
import type { AppLocale } from "../i18n/config";
import { getOwnerDeviceHash } from "../owner/owner-device-client";

/**
 * [A] Owner activation, built from docs/design-canon/pwa/README.md §2.
 *
 * One question per screen and no stepper: the canon asks where you are, which
 * vehicle, and which number, in that order. The activation code sits between
 * the site and the vehicle because the master specification requires it (§6.4)
 * even though the approved sticker has nowhere to print it — see
 * docs/design-canon/CONTRACTS.md.
 *
 * Nothing here is drawn from a mockup number. Values the server does not send
 * are left out rather than filled in (DESIGN_SYSTEM.md §4).
 */
type Step = "CODE" | "DONE" | "LOADING" | "LOCATION" | "PHONE" | "PLATE" | "STOPPED";
type ErrorCode = "CONFLICT" | "INVALID" | "LIMITED" | "UNAVAILABLE" | null;

interface OwnerActivationViewProps {
  copy: OwnerActivationCopy;
  locale: AppLocale;
  publicToken: string;
}

interface SiteSummary {
  /** `sites.address`. Absent until the inspect RPC carries it (CONTRACTS.md). */
  address: string | null;
  name: string | null;
  /** Apartment, officetel, building. Absent for the same reason as the address. */
  type: string | null;
}

const OTP_STEP_TOTAL = 4;

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

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replaceAll(/\{(\w+)\}/gu, (match, key: string) => values[key] ?? match);
}

function clock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/**
 * The canon draws no stepper: there are only a few steps and each screen asks one
 * thing. The position in the flow is announced to assistive technology rather
 * than painted (docs/design-canon/pwa/README.md §2, shared rules).
 */
function ActivationShell({
  actions,
  children,
  label,
}: {
  actions?: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  return (
    <MobileShell
      actions={actions}
      aria-label={label}
      brand={
        // biome-ignore lint/performance/noImgElement: the immutable logo must be served byte-for-byte
        <img alt="Taptolk" height="405" src="/brand/taptolk-logo.png" width="1000" />
      }
    >
      {children}
    </MobileShell>
  );
}

export function OwnerActivationView({ copy, locale, publicToken }: OwnerActivationViewProps) {
  const [step, setStep] = useState<Step>("LOADING");
  const [error, setError] = useState<ErrorCode>(null);
  const [working, setWorking] = useState(false);
  const [site, setSite] = useState<SiteSummary>({ address: null, name: null, type: null });
  const [activationCode, setActivationCode] = useState("");
  const [plate, setPlate] = useState("");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [donePlate, setDonePlate] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  /** An error belongs to the step that produced it; moving on clears it. */
  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/owner-sw.js", { scope: "/" });
    }
    let active = true;
    void postJson("/api/owner/activation/inspect", { locale, publicToken })
      .then((payload) => {
        if (!active) {
          return;
        }
        setSite({
          address: readString(payload.data, "siteAddress"),
          name: readString(payload.data, "siteDisplayName"),
          type: readString(payload.data, "siteType"),
        });
        setStep("LOCATION");
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(mapError(reason));
          setStep("LOCATION");
        }
      });
    return () => {
      active = false;
    };
  }, [locale, publicToken]);

  // The remaining time is the server's, counted down locally so the screen does
  // not poll. It is never used to decide anything — the server owns expiry.
  useEffect(() => {
    if (remaining <= 0) {
      return;
    }
    timer.current = setInterval(() => {
      setRemaining((value) => (value <= 1 ? 0 : value - 1));
    }, 1_000);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [remaining]);

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
      const payload = await postJson("/api/owner/activation/request-otp", {
        deviceHash: await getOwnerDeviceHash(),
        locale,
        phone,
        publicToken,
      });
      const nextChallengeId = payload.data.challengeId;
      if (typeof nextChallengeId !== "string") {
        throw new Error("UNAVAILABLE");
      }
      setChallengeId(nextChallengeId);
      const expiresIn = payload.data.expiresInSeconds;
      setRemaining(typeof expiresIn === "number" ? expiresIn : 0);
    } catch (reason) {
      setError(mapError(reason));
    } finally {
      setWorking(false);
    }
  }

  async function verifyAndComplete() {
    setWorking(true);
    setError(null);
    try {
      const verified = await postJson("/api/owner/activation/verify-otp", {
        challengeId,
        locale,
        otp,
        publicToken,
      });
      const nextProof = verified.data.proof;
      if (typeof nextProof !== "string") {
        throw new Error("UNAVAILABLE");
      }
      const completed = await postJson("/api/owner/activation/complete", {
        activationCode,
        consentAccepted: true,
        deviceHash: await getOwnerDeviceHash(),
        locale,
        plate,
        privacyVersion: "PRIVACY_V1",
        proof: nextProof,
        publicToken,
        termsVersion: "TERMS_V1",
      });
      setDonePlate(readString(completed.data, "vehiclePlateLast4") ?? "");
      setActivationCode("");
      setPhone("");
      setPlate("");
      setOtp("");
      setRemaining(0);
      setStep("DONE");
    } catch (reason) {
      setError(mapError(reason));
    } finally {
      setWorking(false);
    }
  }

  const notice = errorMessage ? <MobileNotice tone="danger">{errorMessage}</MobileNotice> : null;

  if (step === "LOADING") {
    return (
      <ActivationShell>
        <MobileCard center>
          <p className="tt-m-card__note">{copy.loading}</p>
        </MobileCard>
      </ActivationShell>
    );
  }

  if (step === "STOPPED") {
    return (
      <ActivationShell>
        <MobileCard center>
          <SemanticHeading as="h1" className="tt-m-heading" lines={copy.locationStopTitle} />
          <p className="tt-m-card__note">{copy.locationStopBody}</p>
        </MobileCard>
        <MobileNotice center>{copy.homeLink}</MobileNotice>
      </ActivationShell>
    );
  }

  if (step === "DONE") {
    return (
      <ActivationShell>
        <MobileCard center>
          {donePlate ? <Plate plate={donePlate} /> : null}
          <SemanticHeading as="h1" className="tt-m-heading" lines={copy.doneTitle} />
          {site.name ? <p className="tt-m-card__body">{site.name}</p> : null}
          <p className="tt-m-card__note">{copy.doneChannel}</p>
        </MobileCard>
        <MobileLink href={`/${locale}/owner`}>{copy.start}</MobileLink>
      </ActivationShell>
    );
  }

  if (step === "LOCATION") {
    return (
      <ActivationShell
        actions={
          <>
            <MobilePrimary disabled={working} onClick={() => goTo("CODE")}>
              {copy.locationConfirm}
            </MobilePrimary>
            <MobileQuietButton onClick={() => goTo("STOPPED")}>
              {copy.locationWrong}
            </MobileQuietButton>
          </>
        }
        label={fill(copy.stepOf, { current: "1", total: String(OTP_STEP_TOTAL) })}
      >
        {notice}
        <MobileCard center>
          {site.name ? <p className="tt-m-card__body">{site.name}</p> : null}
          {site.type ? <p className="tt-m-card__label">{site.type}</p> : null}
          <p className="tt-m-card__note">{site.address ?? copy.locationAddressMissing}</p>
          <SemanticHeading as="h1" className="tt-m-heading" lines={[copy.locationQuestion]} />
        </MobileCard>
      </ActivationShell>
    );
  }

  if (step === "CODE") {
    return (
      <ActivationShell
        actions={
          <MobileActions>
            <MobileSecondary onClick={() => goTo("LOCATION")}>{copy.back}</MobileSecondary>
            <MobilePrimary disabled={activationCode.length === 0} onClick={() => goTo("PLATE")}>
              {copy.next}
            </MobilePrimary>
          </MobileActions>
        }
        label={fill(copy.stepOf, { current: "2", total: String(OTP_STEP_TOTAL) })}
      >
        {notice}
        <MobileCard>
          <MobileField
            controlId="owner-activation-code"
            hint={copy.activationCodeHint}
            hintId="owner-activation-code-hint"
            label={copy.activationCode}
          >
            <input
              aria-describedby="owner-activation-code-hint"
              autoComplete="one-time-code"
              id="owner-activation-code"
              onChange={(event) => setActivationCode(event.target.value)}
              value={activationCode}
            />
          </MobileField>
        </MobileCard>
      </ActivationShell>
    );
  }

  if (step === "PLATE") {
    return (
      <ActivationShell
        actions={
          <MobileActions>
            <MobileSecondary onClick={() => goTo("CODE")}>{copy.back}</MobileSecondary>
            <MobilePrimary disabled={plate.length === 0} onClick={() => goTo("PHONE")}>
              {copy.next}
            </MobilePrimary>
          </MobileActions>
        }
        label={fill(copy.stepOf, { current: "3", total: String(OTP_STEP_TOTAL) })}
      >
        {notice}
        <SemanticHeading as="h1" className="tt-m-heading" lines={copy.plateTitle} />
        <MobileCard>
          <MobileField
            controlId="owner-vehicle-plate"
            hint={copy.plateFieldHint}
            hintId="owner-vehicle-plate-hint"
            label={copy.plate}
            variant="plate"
          >
            <input
              aria-describedby="owner-vehicle-plate-hint"
              autoCapitalize="characters"
              id="owner-vehicle-plate"
              onChange={(event) => setPlate(event.target.value)}
              value={plate}
            />
          </MobileField>
        </MobileCard>
      </ActivationShell>
    );
  }

  return (
    <ActivationShell
      actions={
        <MobileActions>
          <MobileSecondary onClick={() => goTo("PLATE")}>{copy.back}</MobileSecondary>
          <MobilePrimary
            disabled={working || otp.length === 0 || challengeId.length === 0}
            onClick={() => void verifyAndComplete()}
          >
            {copy.submit}
          </MobilePrimary>
        </MobileActions>
      }
      label={fill(copy.stepOf, { current: "4", total: String(OTP_STEP_TOTAL) })}
    >
      {notice}
      <SemanticHeading as="h1" className="tt-m-heading" lines={copy.phoneTitle} />
      <MobileCard>
        <MobileField
          controlId="owner-phone"
          hint={copy.phoneHint}
          hintId="owner-phone-hint"
          label={copy.phone}
        >
          <input
            aria-describedby="owner-phone-hint"
            autoComplete="tel"
            id="owner-phone"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            value={phone}
          />
        </MobileField>
        <MobileSecondary
          disabled={working || phone.length === 0 || remaining > 0}
          onClick={() => void requestOtp()}
        >
          {remaining > 0
            ? fill(copy.resendIn, { seconds: String(remaining) })
            : challengeId
              ? copy.resend
              : copy.sendCode}
        </MobileSecondary>
        {challengeId ? (
          <MobileField
            controlId="owner-otp"
            hint={fill(copy.otpRemaining, { time: clock(remaining) })}
            hintId="owner-otp-hint"
            label={copy.otp}
            variant="code"
          >
            <input
              aria-describedby="owner-otp-hint"
              autoComplete="one-time-code"
              id="owner-otp"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setOtp(event.target.value)}
              pattern="[0-9]{6}"
              value={otp}
            />
          </MobileField>
        ) : null}
      </MobileCard>
      <MobileNotice>{copy.phonePrivacy}</MobileNotice>
    </ActivationShell>
  );
}
