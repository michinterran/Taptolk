"use client";

import { getPublicContactPollingInterval, type PublicContactStatus } from "@taptolk/domain";
import { SemanticHeading } from "@taptolk/ui";
import { useEffect, useState } from "react";
import type { PublicContactCopy } from "../content/public-contact-copy";
import type { AppLocale } from "../i18n/config";

interface ContactWaitingRoomProps {
  copy: PublicContactCopy;
  locale: AppLocale;
}

interface SessionData {
  expiresAt: string;
  ownerMessages: Array<{ body: string; createdAt: string; replyCode: string | null }>;
  status: PublicContactStatus;
}

interface EscalationData {
  officeAvailable: boolean;
  stage: "OFFICE_AVAILABLE" | "REMINDER" | "WAITING";
}

async function loadSession(): Promise<{
  escalation: EscalationData;
  session: SessionData;
}> {
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
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState(false);
  const [escalation, setEscalation] = useState<EscalationData | null>(null);
  const [officeAlertSent, setOfficeAlertSent] = useState(false);
  const [officeAlertWorking, setOfficeAlertWorking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completeWorking, setCompleteWorking] = useState(false);
  const [_failures, setFailures] = useState(0);
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

  const statusCopy =
    completed || session?.status === "RESOLVED"
      ? copy.waitResolved
      : session?.status === "EXPIRED" || session?.status === "CANCELLED"
        ? copy.waitExpired
        : session?.status === "OWNER_REPLIED" || (session?.ownerMessages.length ?? 0) > 0
          ? copy.waitReply
          : escalation?.stage === "REMINDER"
            ? copy.waitReminder
            : copy.waitQueued;

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

  return (
    <div className="public-contact-shell">
      <header className="public-contact-header">
        {/* biome-ignore lint/performance/noImgElement: immutable logo must be byte-for-byte */}
        <img className="public-contact-logo" src="/brand/taptolk-logo.png" alt="Taptolk" />
        <span className="public-contact-locale">{locale.toUpperCase()}</span>
      </header>
      <section className="public-contact-card" aria-live="polite">
        <p className="eyebrow">{copy.inspectLabel}</p>
        <SemanticHeading
          className="public-contact-title"
          lines={[copy.waitLine1, copy.waitLine2]}
        />
        <p className="public-contact-description">{copy.waitDescription}</p>
        <div className="public-contact-wait-status">
          <span aria-hidden="true" />
          <strong>{statusCopy}</strong>
        </div>
        {session?.ownerMessages.map((message) => (
          <blockquote key={`${message.createdAt}:${message.replyCode ?? ""}`}>
            {message.body}
          </blockquote>
        ))}
        {escalation?.officeAvailable && !officeAlertSent ? (
          <button
            className="public-contact-primary"
            disabled={officeAlertWorking}
            type="button"
            onClick={() => void requestOfficeAlert()}
          >
            {copy.officeAlert}
          </button>
        ) : null}
        {officeAlertSent ? <p className="public-contact-notice">{copy.officeAlertSent}</p> : null}
        {!completed && session?.status === "OWNER_REPLIED" ? (
          <button
            className="public-contact-primary"
            disabled={completeWorking}
            type="button"
            onClick={() => void completeRequest()}
          >
            {completeWorking ? copy.completing : copy.complete}
          </button>
        ) : null}
        {error ? (
          <div className="public-contact-error" role="alert">
            <p>{copy.errorUnavailable}</p>
            <button
              type="button"
              onClick={() => {
                setFailures(0);
                window.location.reload();
              }}
            >
              {copy.retry}
            </button>
          </div>
        ) : null}
        <p className="public-contact-security">{copy.security}</p>
      </section>
    </div>
  );
}
