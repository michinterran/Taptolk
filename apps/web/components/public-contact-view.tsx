"use client";

import { CONTACT_REASON_CODES, type ContactReasonCode } from "@taptolk/domain";
import {
  ChoiceList,
  ChoiceRow,
  MobileCard,
  MobileLink,
  MobileNotice,
  MobilePrimary,
  MobileQuietButton,
  MobileShell,
  Plate,
  SemanticHeading,
} from "@taptolk/ui";
import { useEffect, useState } from "react";
import type { PublicContactCopy } from "../content/public-contact-copy";
import type { AppLocale } from "../i18n/config";
import { reasonIcon } from "./contact-reason-icons";

/**
 * [B-1] Caller compose, from docs/design-canon/pwa/01-caller-compose.png.
 *
 * One screen: the plate at the top as context, the situations as icon rows, and
 * one primary. The plate is shown, not asked — the server already knows which
 * vehicle this sticker belongs to, so the old confirmation step was asking the
 * caller to agree with something they had no way to check.
 *
 * The reasons come from the message catalogue in a fixed order, and only the
 * first three show until the caller asks for more (README §8). The first is
 * emphasised, but there is no star and no "most used" label: that is a claim
 * about frequency and nothing has measured it yet (DESIGN_SYSTEM.md §4).
 */
type Step = "COMPOSE" | "LOADING";
type ErrorCode = "CONFLICT" | "INVALID" | "LIMITED" | "UNAVAILABLE" | null;

/** The canon shows three rows before the "more" link. */
const VISIBLE_REASONS = 3;

/** Reasons the caller picks from. `OTHER` is the free-text box, not a row. */
const PICKABLE_REASONS = CONTACT_REASON_CODES.filter((code) => code !== "OTHER");

interface PublicContactViewProps {
  copy: PublicContactCopy;
  locale: AppLocale;
  /** Localized "Are you the owner of this vehicle?" — owned by the reclaim catalog. */
  ownerEntryLink: string;
  publicToken: string;
}

interface PublicQrData {
  siteDisplayName: string;
  vehicle: { plateLast4: string };
}

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
  const [step, setStep] = useState<Step>("LOADING");
  const [error, setError] = useState<ErrorCode>(null);
  const [working, setWorking] = useState(false);
  const [qr, setQr] = useState<PublicQrData | null>(null);
  const [reasonCode, setReasonCode] = useState<ContactReasonCode | null>(null);
  const [freeMessage, setFreeMessage] = useState("");
  const [showAllReasons, setShowAllReasons] = useState(false);

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
        }
        if (active) {
          setStep("COMPOSE");
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(mapError(reason));
          setStep("COMPOSE");
        }
      });
    return () => {
      active = false;
    };
  }, [locale, publicToken]);

  const typed = freeMessage.trim();
  // What the caller wrote is what they want to say, so it wins over a picked row.
  const message = typed.length > 0 ? typed : reasonCode ? copy.templateMessages[reasonCode] : "";
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

  async function submit() {
    if (!qr || message.length === 0) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await postJson("/api/public/contact-sessions", {
        locale,
        message,
        messageMode: typed.length > 0 ? "FREE_TEXT" : "TEMPLATE",
        plateLast4: qr.vehicle.plateLast4,
        publicToken,
        reasonCode: typed.length > 0 ? "OTHER" : reasonCode,
      });
      window.location.assign(`/${locale}/c/current`);
    } catch (reason) {
      setError(mapError(reason));
    } finally {
      setWorking(false);
    }
  }

  const reasons = showAllReasons ? PICKABLE_REASONS : PICKABLE_REASONS.slice(0, VISIBLE_REASONS);

  return (
    <MobileShell
      actions={
        step === "COMPOSE" ? (
          <>
            <MobilePrimary disabled={working || message.length === 0} onClick={() => void submit()}>
              {working ? copy.preparing : copy.sendAction}
            </MobilePrimary>
            <MobileLink href={`/${locale}/q/${publicToken}/owner`} tone="quiet">
              {ownerEntryLink}
            </MobileLink>
          </>
        ) : null
      }
      brand={
        // biome-ignore lint/performance/noImgElement: the immutable logo must be served byte-for-byte
        <img alt="Taptolk" height="405" src="/brand/taptolk-logo.png" width="1000" />
      }
    >
      {errorMessage ? <MobileNotice tone="danger">{errorMessage}</MobileNotice> : null}

      <MobileCard center>
        {qr ? (
          <>
            {/* The caller never receives the full plate — only its last four
                (docs/design-canon/pwa/README.md §2). Labelling it stops a bare
                four-digit figure from reading as a code. */}
            <span className="tt-m-card__label">{copy.plateLast4Label}</span>
            <Plate plate={qr.vehicle.plateLast4} />
          </>
        ) : null}
        <p className="tt-m-card__body">{copy.composeLead}</p>
      </MobileCard>

      {step === "LOADING" ? (
        <MobileCard center>
          <p className="tt-m-card__note">{copy.loading}</p>
        </MobileCard>
      ) : (
        <>
          <SemanticHeading as="h1" className="tt-m-heading" lines={copy.composeTitle} />

          <ChoiceList>
            {reasons.map((code) => (
              <ChoiceRow
                icon={reasonIcon(code)}
                key={code}
                label={copy.reasonLabels[code]}
                onClick={() => {
                  setReasonCode(code);
                  setFreeMessage("");
                }}
                selected={typed.length === 0 && reasonCode === code}
              />
            ))}
          </ChoiceList>

          {showAllReasons ? null : (
            <MobileQuietButton
              className="tt-m-quiet-link--strong"
              onClick={() => setShowAllReasons(true)}
            >
              {copy.moreReasons}
            </MobileQuietButton>
          )}

          <MobileCard>
            <label className="tt-m-hidden-label" htmlFor="contact-free-message">
              {copy.freeMessage}
            </label>
            <textarea
              aria-describedby="contact-free-message-hint"
              id="contact-free-message"
              onChange={(event) => setFreeMessage(event.target.value)}
              placeholder={copy.freeMessagePlaceholder}
              value={freeMessage}
            />
            <p className="tt-m-card__note" id="contact-free-message-hint">
              {copy.freeMessageHint}
            </p>
          </MobileCard>

          <MobileNotice>{copy.ownerPrivacy}</MobileNotice>
        </>
      )}
    </MobileShell>
  );
}
