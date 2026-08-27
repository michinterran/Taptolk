"use client";

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
import type { OwnerResponseCopy } from "../content/owner-response-copy";
import type { AppLocale } from "../i18n/config";
import { replyIcon } from "./owner-reply-icons";

/**
 * [C-2] Owner reply, from docs/design-canon/pwa/03-owner-reply.png.
 *
 * The same shape as the caller's compose screen, which is what the canon shows:
 * what was received, the replies as icon rows, one primary. Only the first
 * three replies show until the owner asks for more (README §8).
 *
 * This screen is opened from a notification link, so it stands alone — a
 * one-time token, no session, and no tab bar.
 */
type State = "error" | "loading" | "ready" | "success";

interface Inspection {
  callerMessage: string;
  expiresAt: string;
  reasonCode: string;
  siteDisplayName: string;
  vehiclePlateLast4: string;
}

/** The canon shows three rows before the "more" link. */
const VISIBLE_REPLIES = 3;

export function OwnerResponseView({
  copy,
  locale,
  responseToken,
}: {
  copy: OwnerResponseCopy;
  locale: AppLocale;
  responseToken: string;
}) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [working, setWorking] = useState(false);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let active = true;
    void fetch("/api/public/owner-response/inspect", {
      body: JSON.stringify({ responseToken }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("UNAVAILABLE");
        }
        const payload = (await response.json()) as { data: Inspection };
        if (active) {
          setInspection(payload.data);
          setState("ready");
        }
      })
      .catch(() => {
        if (active) {
          setState("error");
        }
      });
    return () => {
      active = false;
    };
  }, [responseToken]);

  const typed = custom.trim();
  const canSend = typed.length > 0 || selected !== null;

  async function submit() {
    setWorking(true);
    try {
      const response = await fetch("/api/public/owner-response/reply", {
        body: JSON.stringify({
          ...(typed.length > 0 ? { body: typed } : {}),
          code: typed.length > 0 ? "CUSTOM" : selected,
          responseToken,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setState(response.ok ? "success" : "error");
    } catch {
      setState("error");
    } finally {
      setWorking(false);
    }
  }

  const brand = (
    // biome-ignore lint/performance/noImgElement: the immutable logo must be served byte-for-byte
    <img alt="Taptolk" height="405" src="/brand/taptolk-logo.png" width="1000" />
  );

  if (state === "loading") {
    return (
      <MobileShell brand={brand}>
        <MobileCard center>
          <p className="tt-m-card__note">{copy.loading}</p>
        </MobileCard>
      </MobileShell>
    );
  }

  if (state === "error") {
    return (
      <MobileShell brand={brand}>
        <MobileCard center>
          <SemanticHeading as="h1" className="tt-m-heading" lines={copy.errorTitle} />
          <p className="tt-m-card__note">{copy.error}</p>
        </MobileCard>
      </MobileShell>
    );
  }

  if (state === "success") {
    return (
      <MobileShell
        actions={<MobileLink href={`/${locale}/owner`}>{copy.back}</MobileLink>}
        brand={brand}
      >
        <MobileCard center>
          <SemanticHeading as="h1" className="tt-m-heading" lines={copy.successTitle} />
          <p className="tt-m-card__note">{copy.success}</p>
        </MobileCard>
      </MobileShell>
    );
  }

  const codes = Object.keys(copy.replies);
  const replies = showAllReplies ? codes : codes.slice(0, VISIBLE_REPLIES);

  return (
    <MobileShell
      actions={
        <MobilePrimary disabled={working || !canSend} onClick={() => void submit()}>
          {copy.submit}
        </MobilePrimary>
      }
      brand={brand}
    >
      <MobileCard center>
        {/* The owner's own vehicle, so the last four is enough to confirm which
            request this is about. */}
        {inspection ? <Plate plate={inspection.vehiclePlateLast4} /> : null}
      </MobileCard>

      {inspection ? (
        <MobileCard label={copy.callerMessage}>
          <p className="tt-m-card__body">{inspection.callerMessage}</p>
        </MobileCard>
      ) : null}

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
        <label className="tt-m-hidden-label" htmlFor="owner-reply-custom">
          {copy.customLabel}
        </label>
        <textarea
          id="owner-reply-custom"
          onChange={(event) => setCustom(event.target.value)}
          placeholder={copy.customPlaceholder}
          value={custom}
        />
      </MobileCard>

      <MobileNotice>{copy.security}</MobileNotice>
    </MobileShell>
  );
}
