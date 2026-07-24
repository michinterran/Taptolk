"use client";

import {
  ChoiceList,
  ChoiceRow,
  MobileCard,
  MobileEmptyState,
  MobileNotice,
  MobilePrimary,
  MobileQuietButton,
  MobileRows,
  MobileSecondary,
  Plate,
  SemanticHeading,
  StatusReadout,
} from "@taptolk/ui";
import { useEffect, useState } from "react";
import { OWNER_RESPONSE_COPY } from "../content/owner-response-copy";
import type { OwnerTabsCopy } from "../content/owner-tabs-copy";
import { PUBLIC_CONTACT_COPY } from "../content/public-contact-copy";
import type { AppLocale } from "../i18n/config";
import {
  decodeVapidPublicKey,
  getOwnerDeviceHash,
  getOwnerPushConfig,
  pushSupported,
  registerOwnerServiceWorker,
} from "../owner/owner-device-client";
import { replyIcon } from "./owner-reply-icons";

/**
 * The four owner tabs (docs/design-canon/pwa/README.md §3).
 *
 * No phone number is drawn on any of them (operator, 2026-07-24). ALERT states
 * that the channel is connected; SETTINGS states that verification is done.
 *
 * MESSAGES and HISTORY render only server-returned rows. A channel state the
 * server cannot tell us is left as unknown — "connected" is never assumed
 * (README §3).
 */
interface OwnerVehicle {
  plateLast4: string;
  qrStatus: "ACTIVE" | "SUSPENDED";
  siteDisplayName?: string;
  siteId: string;
  vehicleId: string;
}

interface OwnerMessage {
  callerMessage: string;
  createdAt: string;
  reasonCode: keyof (typeof PUBLIC_CONTACT_COPY)["ko"]["reasonLabels"];
  replyAvailable?: boolean;
  sessionId: string;
  status: string;
  vehiclePlateLast4: string;
}

interface OwnerHistory {
  createdAt: string;
  reasonCode: keyof (typeof PUBLIC_CONTACT_COPY)["ko"]["reasonLabels"];
  responseSeconds: number | null;
  result: "ANSWERED" | "UNANSWERED";
  sessionId: string;
}

async function loadVehicles(locale: AppLocale): Promise<readonly OwnerVehicle[]> {
  const response = await fetch("/api/owner/vehicles", {
    body: JSON.stringify({ deviceHash: await getOwnerDeviceHash(), locale }),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("UNAVAILABLE");
  }
  const payload = (await response.json()) as { data: { vehicles: OwnerVehicle[] } };
  return payload.data.vehicles;
}

function useVehicles(locale: AppLocale) {
  const [vehicles, setVehicles] = useState<readonly OwnerVehicle[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void loadVehicles(locale)
      .then((next) => {
        if (active) {
          setVehicles(next);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [locale]);

  return { failed, vehicles };
}

async function postOwnerSession<T>(path: string, locale: AppLocale): Promise<T> {
  const response = await fetch(path, {
    body: JSON.stringify({ deviceHash: await getOwnerDeviceHash(), locale }),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("UNAVAILABLE");
  }
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

function useOwnerMessages(locale: AppLocale) {
  const [messages, setMessages] = useState<readonly OwnerMessage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void postOwnerSession<{ messages: OwnerMessage[] }>("/api/owner/messages", locale)
      .then((payload) => {
        if (active) {
          setMessages(payload.messages);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [locale]);

  return { failed, messages };
}

function useOwnerHistory(locale: AppLocale) {
  const [history, setHistory] = useState<readonly OwnerHistory[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void postOwnerSession<{ history: OwnerHistory[] }>("/api/owner/history", locale)
      .then((payload) => {
        if (active) {
          setHistory(payload.history);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [locale]);

  return { failed, history };
}

function formatDateTime(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number | null, locale: AppLocale): string | undefined {
  if (seconds === null) {
    return undefined;
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return locale === "ko" ? `${minutes}분` : `${minutes}m`;
}

function Unavailable({ copy }: { copy: OwnerTabsCopy }) {
  return (
    <>
      <MobileNotice tone="danger">{copy.unavailable}</MobileNotice>
      <MobilePrimary onClick={() => window.location.reload()}>{copy.retry}</MobilePrimary>
    </>
  );
}

/** [C-1] MESSAGES — the default tab. */
export function OwnerMessagesView({ copy, locale }: { copy: OwnerTabsCopy; locale: AppLocale }) {
  const { failed, messages } = useOwnerMessages(locale);
  const reasonLabels = PUBLIC_CONTACT_COPY[locale].reasonLabels;
  return (
    <>
      <SemanticHeading as="h1" className="tt-m-heading" lines={copy.messagesTitle} />
      {failed ? <Unavailable copy={copy} /> : null}
      {messages === null && !failed ? (
        <MobileCard center>
          <p className="tt-m-card__note">{copy.loading}</p>
        </MobileCard>
      ) : null}
      {messages !== null && !failed ? (
        <MobileCard className="tt-owner-message-list-card">
          {messages && messages.length > 0 ? (
            <ul className="tt-owner-message-list">
              {messages.map((message) => (
                <li key={message.sessionId}>
                  <a
                    className="tt-owner-message-link"
                    href={`/${locale}/owner/messages/${message.sessionId}`}
                  >
                    <span className="tt-owner-message-link__meta">
                      {formatDateTime(message.createdAt, locale)} ·{" "}
                      {reasonLabels[message.reasonCode]}
                    </span>
                    <strong>{message.callerMessage}</strong>
                    {message.replyAvailable ? (
                      <span className="tt-owner-message-link__action">{copy.messagesReply}</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <MobileEmptyState
              description={copy.messagesEmptyBody}
              title={copy.messagesEmptyTitle}
            />
          )}
        </MobileCard>
      ) : null}
    </>
  );
}

export function OwnerMessageReplyView({
  locale,
  sessionId,
}: {
  locale: AppLocale;
  sessionId: string;
}) {
  const copy = OWNER_RESPONSE_COPY[locale];
  const [message, setMessage] = useState<OwnerMessage | null>(null);
  const [selected, setSelected] = useState<string | null>("MOVING_NOW");
  const [custom, setCustom] = useState("");
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    void postOwnerSession<{ message: OwnerMessage }>(`/api/owner/messages/${sessionId}`, locale)
      .then((payload) => {
        if (active) {
          setMessage(payload.message);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [locale, sessionId]);

  const typed = custom.trim();
  const canSend = !success && !failed && (typed.length > 0 || selected !== null);
  const codes = Object.keys(copy.replies);
  const replies = showAllReplies ? codes : codes.slice(0, 3);

  async function submit() {
    setWorking(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/owner/messages/${sessionId}/reply`, {
        body: JSON.stringify({
          ...(typed.length > 0 ? { body: typed } : {}),
          code: typed.length > 0 ? "CUSTOM" : selected,
          deviceHash: await getOwnerDeviceHash(),
          locale,
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("UNAVAILABLE");
      }
      setSuccess(true);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
    }
  }

  if (success) {
    return (
      <>
        <MobileCard center>
          {message ? <Plate plate={message.vehiclePlateLast4} /> : null}
          <SemanticHeading as="h1" className="tt-m-heading" lines={copy.successTitle} />
          <p className="tt-m-card__note">{copy.success}</p>
        </MobileCard>
        <MobilePrimary onClick={() => window.location.assign(`/${locale}/owner`)}>
          {copy.back}
        </MobilePrimary>
      </>
    );
  }

  return (
    <>
      {failed ? <MobileNotice tone="danger">{copy.error}</MobileNotice> : null}
      {message ? (
        <MobileCard label={copy.callerMessage}>
          <p className="tt-m-card__body">{message.callerMessage}</p>
        </MobileCard>
      ) : (
        <MobileCard center>
          <p className="tt-m-card__note">{copy.loading}</p>
        </MobileCard>
      )}

      <ChoiceList>
        {replies.map((code) => (
          <ChoiceRow
            icon={replyIcon(code)}
            key={code}
            label={copy.replies[code]}
            onClick={() => {
              setSelected(code);
              setCustom("");
            }}
            selected={typed.length === 0 && selected === code}
          />
        ))}
      </ChoiceList>

      {showAllReplies ? null : (
        <MobileQuietButton
          className="tt-m-quiet-link--strong"
          onClick={() => setShowAllReplies(true)}
        >
          {copy.moreReplies}
        </MobileQuietButton>
      )}

      <MobileCard>
        <label className="tt-m-hidden-label" htmlFor="owner-pwa-reply-custom">
          {copy.customLabel}
        </label>
        <textarea
          id="owner-pwa-reply-custom"
          onChange={(event) => setCustom(event.target.value)}
          placeholder={copy.customPlaceholder}
          value={custom}
        />
      </MobileCard>

      <MobilePrimary disabled={working || !canSend} onClick={() => void submit()}>
        {copy.submit}
      </MobilePrimary>
    </>
  );
}

/** [C-3] ALERT — where the owner checks that they can still be reached. */
export function OwnerAlertView({ copy, locale }: { copy: OwnerTabsCopy; locale: AppLocale }) {
  const [pushReady, setPushReady] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushFailed, setPushFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!pushSupported()) {
        return;
      }
      const config = await getOwnerPushConfig();
      if (!active || !config.enabled) {
        return;
      }
      const state = await postOwnerSession<{ subscribed: boolean }>(
        "/api/owner/push/state",
        locale,
      );
      if (active) {
        setPushReady(true);
        setPushSubscribed(state.subscribed);
      }
    }
    void load().catch(() => {
      if (active) {
        setPushFailed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [locale]);

  async function enablePush() {
    try {
      setPushFailed(false);
      const config = await getOwnerPushConfig();
      if (!config.enabled || !pushSupported()) {
        setPushFailed(true);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushFailed(true);
        return;
      }
      const registration = await registerOwnerServiceWorker();
      let subscription = await registration?.pushManager.getSubscription();
      subscription ??= await registration?.pushManager.subscribe({
        applicationServerKey: decodeVapidPublicKey(config.publicKey),
        userVisibleOnly: true,
      });
      if (!subscription) {
        setPushFailed(true);
        return;
      }
      const response = await fetch("/api/owner/push/subscribe", {
        body: JSON.stringify({
          deviceHash: await getOwnerDeviceHash(),
          locale,
          subscription: subscription.toJSON(),
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("UNAVAILABLE");
      }
      const payload = (await response.json()) as { data: { subscribed: boolean } };
      setPushSubscribed(payload.data.subscribed);
    } catch {
      setPushFailed(true);
    }
  }

  return (
    <>
      <SemanticHeading as="h1" className="tt-m-heading" lines={copy.alertTitle} />
      <MobileCard>
        {/* The server does not report whether the channel is blocked, so the
            state is unknown rather than "connected" (README §3). */}
        <StatusReadout label={copy.alertChannel} status={copy.alertUnknown} />
        <p className="tt-m-card__note">{copy.alertVerifiedNumber}</p>
        <p className="tt-m-card__note">{copy.alertBlockedWarning}</p>
      </MobileCard>
      <MobileCard>
        {/* Web Push is optional and is a control, not a value, so it sits in the
            row's action slot rather than reading as a state. */}
        <MobileRows
          rows={[
            {
              action: (
                <MobileQuietButton
                  className="tt-m-quiet-link--strong"
                  disabled={!pushReady || pushSubscribed}
                  onClick={enablePush}
                >
                  {copy.alertDeviceEnable}
                </MobileQuietButton>
              ),
              label: copy.alertDevice,
              value: pushSubscribed ? copy.alertConnected : null,
            },
          ]}
        />
        {pushFailed ? <MobileNotice tone="danger">{copy.unavailable}</MobileNotice> : null}
      </MobileCard>
    </>
  );
}

/** [C-4] HISTORY — one line per past request. */
export function OwnerHistoryView({ copy, locale }: { copy: OwnerTabsCopy; locale: AppLocale }) {
  const { failed, history } = useOwnerHistory(locale);
  const reasonLabels = PUBLIC_CONTACT_COPY[locale].reasonLabels;
  return (
    <>
      <SemanticHeading as="h1" className="tt-m-heading" lines={copy.historyTitle} />
      {failed ? <Unavailable copy={copy} /> : null}
      {history === null && !failed ? (
        <MobileCard center>
          <p className="tt-m-card__note">{copy.loading}</p>
        </MobileCard>
      ) : null}
      {history !== null && !failed ? (
        <MobileCard>
          {history && history.length > 0 ? (
            <MobileRows
              rows={history.map((item) => ({
                label: `${formatDateTime(item.createdAt, locale)} · ${reasonLabels[item.reasonCode]}`,
                value:
                  item.result === "ANSWERED"
                    ? `${copy.historyAnswered} ${formatDuration(item.responseSeconds, locale) ?? "—"}`
                    : copy.historyUnanswered,
              }))}
            />
          ) : (
            <MobileEmptyState description={copy.historyEmptyBody} title={copy.historyEmptyTitle} />
          )}
        </MobileCard>
      ) : null}
    </>
  );
}

type Confirming = "RELEASE" | "SUSPEND" | null;

/** [C-5] SETTINGS and [C-6] the two confirmations. */
export function OwnerSettingsView({ copy, locale }: { copy: OwnerTabsCopy; locale: AppLocale }) {
  const { failed, vehicles } = useVehicles(locale);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const vehicle = vehicles?.[0];

  if (confirming) {
    const release = confirming === "RELEASE";
    return (
      <>
        <MobileCard center>
          <SemanticHeading
            as="h1"
            className="tt-m-heading"
            lines={release ? copy.releaseTitle : copy.suspendTitle}
          />
          <p className="tt-m-card__note">{release ? copy.releaseBody : copy.suspendBody}</p>
        </MobileCard>
        {/* Ending a registration keeps the record. The confirmation says so
            rather than letting the owner find out afterwards (README §3). */}
        {release ? <MobileNotice center>{copy.releaseAuditNote}</MobileNotice> : null}
        <MobilePrimary disabled>{copy.confirm}</MobilePrimary>
        <MobileQuietButton onClick={() => setConfirming(null)}>{copy.cancel}</MobileQuietButton>
      </>
    );
  }

  return (
    <>
      <SemanticHeading as="h1" className="tt-m-heading" lines={copy.settingsTitle} />
      {failed ? <Unavailable copy={copy} /> : null}
      {vehicles === null && !failed ? (
        <MobileCard center>
          <p className="tt-m-card__note">{copy.loading}</p>
        </MobileCard>
      ) : null}
      {vehicles ? (
        <MobileCard>
          <MobileRows
            rows={[
              { label: copy.settingsPlate, value: vehicle?.plateLast4 },
              // The number itself is never sent to the browser; only the fact
              // that it was verified (operator, 2026-07-24).
              { label: copy.settingsContact, value: copy.settingsContactVerified },
              { label: copy.settingsSite, value: vehicle?.siteDisplayName },
              { label: copy.settingsStickerState, value: vehicle?.qrStatus },
            ]}
          />
        </MobileCard>
      ) : null}
      {/* Pausing can be undone and ending cannot, so they are not drawn with the
          same weight — only the second one is danger (README §3). Neither is
          offered while the sticker's state is unknown: acting on something we
          could not load is worse than making the owner retry. */}
      {vehicles ? (
        <>
          <MobileSecondary onClick={() => setConfirming("SUSPEND")}>{copy.suspend}</MobileSecondary>
          <MobileQuietButton
            className="tt-m-quiet-link--danger"
            onClick={() => setConfirming("RELEASE")}
          >
            {copy.release}
          </MobileQuietButton>
        </>
      ) : null}
    </>
  );
}
