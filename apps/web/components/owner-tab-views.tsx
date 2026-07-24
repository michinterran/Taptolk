"use client";

import {
  MobileCard,
  MobileEmptyState,
  MobileNotice,
  MobilePrimary,
  MobileQuietButton,
  MobileRows,
  MobileSecondary,
  SemanticHeading,
  StatusReadout,
} from "@taptolk/ui";
import { useEffect, useState } from "react";
import type { OwnerTabsCopy } from "../content/owner-tabs-copy";
import type { AppLocale } from "../i18n/config";
import { getOwnerDeviceHash } from "../owner/owner-device-client";

/**
 * The four owner tabs (docs/design-canon/pwa/README.md §3).
 *
 * No phone number is drawn on any of them (operator, 2026-07-24). ALERT states
 * that the channel is connected; SETTINGS states that verification is done.
 *
 * MESSAGES and HISTORY have no endpoint yet, so they show what will fill them
 * rather than a sample. A channel state the server cannot tell us is left as
 * unknown — "connected" is never assumed (README §3).
 */
interface OwnerVehicle {
  plateLast4: string;
  qrStatus: "ACTIVE" | "SUSPENDED";
  siteId: string;
  vehicleId: string;
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

function Unavailable({ copy }: { copy: OwnerTabsCopy }) {
  return (
    <>
      <MobileNotice tone="danger">{copy.unavailable}</MobileNotice>
      <MobilePrimary onClick={() => window.location.reload()}>{copy.retry}</MobilePrimary>
    </>
  );
}

/** [C-1] MESSAGES — the default tab. */
export function OwnerMessagesView({ copy }: { copy: OwnerTabsCopy; locale: AppLocale }) {
  return (
    <>
      <SemanticHeading as="h1" className="tt-m-heading" lines={copy.messagesTitle} />
      <MobileCard>
        {/* Open requests arrive through the notification link, which opens the
            reply screen. There is no endpoint that lists them yet — see
            docs/design-canon/CONTRACTS.md. */}
        <MobileEmptyState description={copy.messagesEmptyBody} title={copy.messagesEmptyTitle} />
      </MobileCard>
    </>
  );
}

/** [C-3] ALERT — where the owner checks that they can still be reached. */
export function OwnerAlertView({ copy }: { copy: OwnerTabsCopy; locale: AppLocale }) {
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
                <MobileQuietButton className="tt-m-quiet-link--strong" disabled>
                  {copy.alertDeviceEnable}
                </MobileQuietButton>
              ),
              label: copy.alertDevice,
              value: null,
            },
          ]}
        />
      </MobileCard>
    </>
  );
}

/** [C-4] HISTORY — one line per past request. */
export function OwnerHistoryView({ copy }: { copy: OwnerTabsCopy; locale: AppLocale }) {
  return (
    <>
      <SemanticHeading as="h1" className="tt-m-heading" lines={copy.historyTitle} />
      <MobileCard>
        {/* A result that never came is an em dash, never a zero (README §3).
            The endpoint does not exist yet. */}
        <MobileEmptyState description={copy.historyEmptyBody} title={copy.historyEmptyTitle} />
      </MobileCard>
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
