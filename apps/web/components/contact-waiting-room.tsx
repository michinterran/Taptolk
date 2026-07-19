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

async function loadSession(): Promise<SessionData> {
  const response = await fetch("/api/public/contact-sessions/current", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "UNAUTHORIZED" : "UNAVAILABLE");
  }
  const payload = (await response.json()) as { data?: SessionData };
  if (!payload.data) {
    throw new Error("UNAVAILABLE");
  }
  return payload.data;
}

export function ContactWaitingRoom({ copy, locale }: ContactWaitingRoomProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState(false);
  const [_failures, setFailures] = useState(0);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const next = await loadSession();
        if (!active) {
          return;
        }
        setSession(next);
        setError(false);
        setFailures(0);
        const delay = getPublicContactPollingInterval({
          elapsedSeconds: Math.max(0, (Date.now() - startedAt) / 1000),
          hidden: document.hidden,
          status: next.status,
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
  }, [startedAt]);

  const statusCopy =
    session?.status === "RESOLVED"
      ? copy.waitResolved
      : session?.status === "EXPIRED" || session?.status === "CANCELLED"
        ? copy.waitExpired
        : session?.status === "OWNER_REPLIED" || (session?.ownerMessages.length ?? 0) > 0
          ? copy.waitReply
          : copy.waitQueued;

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
