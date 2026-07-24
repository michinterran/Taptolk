"use client";

import {
  type ContactReasonCode,
  getPublicContactPollingInterval,
  type PublicContactStatus,
} from "@taptolk/domain";
import {
  MobileCard,
  MobileFacts,
  MobileLink,
  MobileNotice,
  MobilePrimary,
  MobileSecondary,
  MobileShell,
  Plate,
  SemanticHeading,
  StatusReadout,
} from "@taptolk/ui";
import { useEffect, useState } from "react";
import type { PublicContactCopy } from "../content/public-contact-copy";
import type { AppLocale } from "../i18n/config";

/**
 * [B-2] waiting, [B-3] escalation, [B-4] the reply, [B-6] expiry — from
 * 02-caller-sent-waiting.png, 04-caller-response-received.png and README §6.
 *
 * The four are one screen with different content, because that is what the
 * mockups are: the plate card, what was said, where it stands, one primary.
 *
 * "Sent" is not "read" and "read" is not "answered". The status line says
 * exactly which of those happened and never stands in for another (README §6).
 *
 * The mockup's average-response-time line is not drawn. Elapsed time is, because the
 * server measures it (DESIGN_SYSTEM.md §4).
 */
interface ContactWaitingRoomProps {
  copy: PublicContactCopy;
  locale: AppLocale;
}

interface SessionData {
  /** The caller's own message. Absent once the body has expired (README §13). */
  callerMessage?: string;
  callerMessageCount: number;
  /** How many round trips remain. Absent until the server sends a limit. */
  callerMessagesRemaining?: number;
  createdAt?: string;
  expiresAt: string;
  ownerMessages: Array<{ body: string; createdAt: string; replyCode: string | null }>;
  reasonCode?: ContactReasonCode;
  status: PublicContactStatus;
  vehiclePlateLast4?: string;
}

interface EscalationData {
  elapsedSeconds?: number;
  officeAvailable: boolean;
  stage: "OFFICE_AVAILABLE" | "REMINDER" | "WAITING";
}

function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replaceAll(/\{(\w+)\}/gu, (match, key: string) => values[key] ?? match);
}

/** A wall-clock stamp for the request and reply rows in canon 04. */
function stamp(locale: AppLocale, value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? undefined
    : parsed.toLocaleString(locale === "ko" ? "ko-KR" : "en-GB", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

async function loadSession(): Promise<{ escalation: EscalationData; session: SessionData }> {
  const [sessionResponse, escalationResponse] = await Promise.all([
    fetch("/api/public/contact-sessions/current", {
      cache: "no-store",
      credentials: "same-origin",
    }),
    fetch("/api/public/contact-sessions/escalation", {
      cache: "no-store",
      credentials: "same-origin",
    }),
  ]);
  if (!sessionResponse.ok || !escalationResponse.ok) {
    throw new Error(
      sessionResponse.status === 401 || escalationResponse.status === 401
        ? "UNAUTHORIZED"
        : "UNAVAILABLE",
    );
  }
  const sessionPayload = (await sessionResponse.json()) as { data?: SessionData };
  const escalationPayload = (await escalationResponse.json()) as { data?: EscalationData };
  if (!sessionPayload.data || !escalationPayload.data) {
    throw new Error("UNAVAILABLE");
  }
  return { escalation: escalationPayload.data, session: sessionPayload.data };
}

export function ContactWaitingRoom({ copy, locale }: ContactWaitingRoomProps) {
  // The plate is not in the session response, so canon 02 and 04's plate card is
  // not drawn here yet — see docs/design-canon/CONTRACTS.md.
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState(false);
  const [escalation, setEscalation] = useState<EscalationData | null>(null);
  const [officeAlertSent, setOfficeAlertSent] = useState(false);
  const [officeAlertWorking, setOfficeAlertWorking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completeWorking, setCompleteWorking] = useState(false);
  // Only the setter is read; the count drives the backoff inside the updater.
  const [, setFailures] = useState(0);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    if (completed) {
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const next = await loadSession();
        if (!active) {
          return;
        }
        setSession(next.session);
        setEscalation(next.escalation);
        setError(false);
        setFailures(0);
        const delay = getPublicContactPollingInterval({
          elapsedSeconds: Math.max(0, (Date.now() - startedAt) / 1000),
          hidden: document.hidden,
          status: next.session.status,
        });
        if (delay !== null) {
          timer = setTimeout(() => void poll(), delay);
        }
      } catch {
        if (!active) {
          return;
        }
        setError(true);
        setFailures((current) => {
          const nextFailures = current + 1;
          timer = setTimeout(() => void poll(), Math.min(3_000 * 2 ** nextFailures, 30_000));
          return nextFailures;
        });
      }
    };

    const onVisibility = () => {
      if (!document.hidden) {
        if (timer) {
          clearTimeout(timer);
        }
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    void poll();
    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [completed, startedAt]);

  const replied = session?.status === "OWNER_REPLIED" || (session?.ownerMessages.length ?? 0) > 0;
  const resolved = completed || session?.status === "RESOLVED";
  const expired = session?.status === "EXPIRED" || session?.status === "CANCELLED";

  const status = resolved
    ? copy.waitResolved
    : expired
      ? copy.waitExpired
      : replied
        ? copy.waitReply
        : escalation?.stage === "REMINDER"
          ? copy.waitReminder
          : copy.waitQueued;

  const elapsedSeconds = escalation?.elapsedSeconds;
  const elapsed =
    typeof elapsedSeconds === "number"
      ? fill(copy.elapsed, {
          elapsed:
            elapsedSeconds >= 60
              ? fill(copy.elapsedMinutes, {
                  minutes: String(Math.floor(elapsedSeconds / 60)),
                  seconds: String(Math.floor(elapsedSeconds % 60)),
                })
              : fill(copy.elapsedSeconds, { seconds: String(Math.floor(elapsedSeconds)) }),
        })
      : undefined;

  // The caller's own words when the server still holds them, otherwise the
  // template they picked. Neither is invented: if both are gone the card goes.
  const sentMessage =
    session?.callerMessage ??
    (session?.reasonCode ? copy.templateMessages[session.reasonCode] : undefined);

  async function requestOfficeAlert() {
    setOfficeAlertWorking(true);
    setError(false);
    try {
      const response = await fetch("/api/public/contact-sessions/escalation", {
        credentials: "same-origin",
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("UNAVAILABLE");
      }
      setOfficeAlertSent(true);
      setEscalation({ officeAvailable: false, stage: "OFFICE_AVAILABLE" });
    } catch {
      setError(true);
    } finally {
      setOfficeAlertWorking(false);
    }
  }

  async function completeRequest() {
    setCompleteWorking(true);
    setError(false);
    try {
      const response = await fetch("/api/public/contact-sessions/current/resolve", {
        credentials: "same-origin",
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("UNAVAILABLE");
      }
      setCompleted(true);
      setEscalation(null);
      setSession((current) => (current ? { ...current, status: "RESOLVED" } : current));
    } catch {
      setError(true);
    } finally {
      setCompleteWorking(false);
    }
  }

  const brand = (
    // biome-ignore lint/performance/noImgElement: the immutable logo must be served byte-for-byte
    <img alt="Taptolk" height="405" src="/brand/taptolk-logo.png" width="1000" />
  );

  if (expired) {
    return (
      <MobileShell brand={brand}>
        <MobileCard center>
          <SemanticHeading as="h1" className="tt-m-heading" lines={copy.expiredTitle} />
          <p className="tt-m-card__note">{copy.expiredBody}</p>
        </MobileCard>
      </MobileShell>
    );
  }

  const facts = [
    { label: copy.requestTimeLabel, value: stamp(locale, session?.createdAt) },
    { label: copy.replyTimeLabel, value: stamp(locale, session?.ownerMessages[0]?.createdAt) },
  ].filter((fact) => fact.value !== undefined);

  return (
    <MobileShell
      className={replied ? "tt-m-shell--contact-result" : "tt-m-shell--contact-wait"}
      actions={
        <>
          {replied && !resolved ? (
            <MobilePrimary disabled={completeWorking} onClick={() => void completeRequest()}>
              {completeWorking ? copy.completing : copy.complete}
            </MobilePrimary>
          ) : resolved ? null : (
            <MobilePrimary onClick={() => window.location.reload()}>{copy.refresh}</MobilePrimary>
          )}

          {/* README §6: past the threshold the caller is offered the office. The
              canon wants a tel: button labelled with the office name; the server
              sends a boolean today, so this is the alert it does support. */}
          {escalation?.officeAvailable && !officeAlertSent && !resolved ? (
            <MobileSecondary
              disabled={officeAlertWorking}
              onClick={() => void requestOfficeAlert()}
            >
              {copy.officeAlert}
            </MobileSecondary>
          ) : null}

          <MobileLink href={`/${locale}/c/current`}>{copy.historyLink}</MobileLink>
        </>
      }
      brand={brand}
    >
      {error ? <MobileNotice tone="danger">{copy.errorUnavailable}</MobileNotice> : null}

      <MobileCard center>
        {session?.vehiclePlateLast4 ? <Plate plate={session.vehiclePlateLast4} /> : null}
        <p className="tt-m-card__body">{replied ? copy.repliedLead : copy.waitLead}</p>
      </MobileCard>

      {sentMessage ? (
        <MobileCard label={copy.sentMessageLabel}>
          <p className="tt-m-card__body">{sentMessage}</p>
        </MobileCard>
      ) : null}

      {session?.ownerMessages.map((message) => (
        <MobileCard
          key={`${message.createdAt}:${message.replyCode ?? ""}`}
          label={copy.receivedMessageLabel}
          outlined
        >
          <p className="tt-m-card__body">{message.body}</p>
        </MobileCard>
      ))}

      <StatusReadout label={copy.statusLabel} meta={elapsed} status={status} />

      {facts.length > 0 ? <MobileFacts facts={facts} /> : null}

      {typeof session?.callerMessagesRemaining === "number" ? (
        <MobileNotice center>
          {fill(copy.turnsLeft, { count: String(session.callerMessagesRemaining) })}
        </MobileNotice>
      ) : null}

      {officeAlertSent ? <MobileNotice center>{copy.officeAlertSent}</MobileNotice> : null}
    </MobileShell>
  );
}
