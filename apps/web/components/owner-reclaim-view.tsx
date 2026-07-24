"use client";

import {
  MobileActions,
  MobileCard,
  MobileField,
  MobileLink,
  MobileNotice,
  MobilePrimary,
  MobileSecondary,
  MobileShell,
  SemanticHeading,
} from "@taptolk/ui";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { OwnerReclaimCopy } from "../content/owner-reclaim-copy";
import type { AppLocale } from "../i18n/config";
import { getOwnerDeviceHash } from "../owner/owner-device-client";

/**
 * [R] Re-entry, from docs/design-canon/pwa/README.md §1.
 *
 * An owner who changed phone or opened the sticker in a private window has no
 * session, so their own sticker shows them the contact screen. This is the way
 * back: plate, then phone verification — the same order as activation.
 *
 * It is not registration. The binding is left alone and only a new owner
 * session is opened on this device, and the copy says so, because a screen that
 * asks for a plate and a phone otherwise reads as registering the car twice.
 *
 * The server checks that both match this sticker's binding. One of the two
 * matching is not enough, and a mismatch never says which one failed.
 */
type Step = "DONE" | "PHONE" | "PLATE";
type ErrorCode = "LIMITED" | "MISMATCH" | "UNAVAILABLE" | null;

async function postJson(path: string, body: Readonly<Record<string, unknown>>) {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { code?: string } }).error?.code
        : undefined;
    throw new Error(code ?? "UNAVAILABLE");
  }
  return payload as { data: Record<string, unknown> };
}

/**
 * Every way of being wrong reads the same. `INVALID`, `CONFLICT` and a plain
 * `404` all mean "this does not match this sticker" to the person holding the
 * phone, and separating them would let someone narrow down one field at a time.
 */
function mapError(error: unknown): ErrorCode {
  if (error instanceof Error && error.message === "LIMITED") {
    return "LIMITED";
  }
  if (
    error instanceof Error &&
    (error.message === "INVALID" || error.message === "VALIDATION" || error.message === "CONFLICT")
  ) {
    return "MISMATCH";
  }
  return "UNAVAILABLE";
}

function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replaceAll(/\{(\w+)\}/gu, (match, key: string) => values[key] ?? match);
}

function clock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function ReclaimShell({
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

export function OwnerReclaimView({
  copy,
  locale,
  publicToken,
}: {
  copy: OwnerReclaimCopy;
  locale: AppLocale;
  publicToken: string;
}) {
  const [step, setStep] = useState<Step>("PLATE");
  const [error, setError] = useState<ErrorCode>(null);
  const [working, setWorking] = useState(false);
  const [plate, setPlate] = useState("");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    error === "MISMATCH"
      ? copy.mismatch
      : error === "LIMITED"
        ? copy.limited
        : error
          ? copy.unavailable
          : null;

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  async function requestCode() {
    setWorking(true);
    setError(null);
    try {
      const payload = await postJson("/api/owner/session/reclaim/request-otp", {
        deviceHash: await getOwnerDeviceHash(),
        locale,
        phone,
        plate,
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

  async function confirm() {
    setWorking(true);
    setError(null);
    try {
      await postJson("/api/owner/session/reclaim/verify", {
        challengeId,
        deviceHash: await getOwnerDeviceHash(),
        locale,
        otp,
        publicToken,
      });
      setPlate("");
      setPhone("");
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

  if (step === "DONE") {
    return (
      <ReclaimShell>
        <MobileCard center>
          <SemanticHeading as="h1" className="tt-m-heading" lines={copy.doneTitle} />
          <p className="tt-m-card__note">{copy.doneBody}</p>
        </MobileCard>
        <MobileLink href={`/${locale}/owner`}>{copy.openOwner}</MobileLink>
      </ReclaimShell>
    );
  }

  if (step === "PLATE") {
    return (
      <ReclaimShell
        actions={
          <MobilePrimary disabled={plate.length === 0} onClick={() => goTo("PHONE")}>
            {copy.next}
          </MobilePrimary>
        }
      >
        {notice}
        <MobileCard center>
          <SemanticHeading as="h1" className="tt-m-heading" lines={copy.intro} />
          <p className="tt-m-card__note">{copy.introBody}</p>
        </MobileCard>
        <SemanticHeading as="h2" className="tt-m-heading" lines={copy.plateTitle} />
        <MobileCard>
          <MobileField
            controlId="owner-reclaim-plate"
            hint={copy.plateHint}
            hintId="owner-reclaim-plate-hint"
            label={copy.plateLabel}
            variant="plate"
          >
            <input
              aria-describedby="owner-reclaim-plate-hint"
              autoCapitalize="characters"
              id="owner-reclaim-plate"
              onChange={(event) => setPlate(event.target.value)}
              value={plate}
            />
          </MobileField>
        </MobileCard>
      </ReclaimShell>
    );
  }

  return (
    <ReclaimShell
      actions={
        <MobileActions>
          <MobileSecondary onClick={() => goTo("PLATE")}>{copy.back}</MobileSecondary>
          <MobilePrimary
            disabled={working || otp.length === 0 || challengeId.length === 0}
            onClick={() => void confirm()}
          >
            {copy.submit}
          </MobilePrimary>
        </MobileActions>
      }
    >
      {notice}
      <SemanticHeading as="h1" className="tt-m-heading" lines={copy.phoneTitle} />
      <MobileCard>
        <MobileField
          controlId="owner-reclaim-phone"
          hint={copy.phoneHint}
          hintId="owner-reclaim-phone-hint"
          label={copy.phoneLabel}
        >
          <input
            aria-describedby="owner-reclaim-phone-hint"
            autoComplete="tel"
            id="owner-reclaim-phone"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            value={phone}
          />
        </MobileField>
        <MobileSecondary
          disabled={working || phone.length === 0 || remaining > 0}
          onClick={() => void requestCode()}
        >
          {remaining > 0
            ? fill(copy.resendIn, { seconds: String(remaining) })
            : challengeId
              ? copy.resend
              : copy.sendCode}
        </MobileSecondary>
        {challengeId ? (
          <MobileField
            controlId="owner-reclaim-otp"
            hint={fill(copy.otpRemaining, { time: clock(remaining) })}
            hintId="owner-reclaim-otp-hint"
            label={copy.otpLabel}
            variant="code"
          >
            <input
              aria-describedby="owner-reclaim-otp-hint"
              autoComplete="one-time-code"
              id="owner-reclaim-otp"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setOtp(event.target.value)}
              pattern="[0-9]{6}"
              value={otp}
            />
          </MobileField>
        ) : null}
      </MobileCard>
    </ReclaimShell>
  );
}
