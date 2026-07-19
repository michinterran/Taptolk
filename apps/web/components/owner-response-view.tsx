"use client";

import { SemanticHeading } from "@taptolk/ui";
import { useEffect, useState } from "react";
import type { OwnerResponseCopy } from "../content/owner-response-copy";
import type { AppLocale } from "../i18n/config";

interface Inspection {
  callerMessage: string;
  expiresAt: string;
  reasonCode: string;
  siteDisplayName: string;
  vehiclePlateLast4: string;
}

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
  const [selected, setSelected] = useState("MOVING_NOW");
  const [custom, setCustom] = useState("");
  const [state, setState] = useState<"error" | "loading" | "ready" | "success">("loading");

  useEffect(() => {
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
        setInspection(payload.data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [responseToken]);

  async function submit() {
    const response = await fetch("/api/public/owner-response/reply", {
      body: JSON.stringify({
        ...(selected === "CUSTOM" ? { body: custom } : {}),
        code: selected,
        responseToken,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setState(response.ok ? "success" : "error");
  }

  return (
    <div className="owner-response-shell">
      <header className="owner-response-header">
        {/* biome-ignore lint/performance/noImgElement: immutable logo must be byte-for-byte */}
        <img className="public-contact-logo" src="/brand/taptolk-logo.png" alt="Taptolk" />
        <span className="public-contact-locale">{locale.toUpperCase()}</span>
      </header>
      <section className="owner-response-card" aria-live="polite">
        <p className="eyebrow">{copy.eyebrow}</p>
        <SemanticHeading className="public-contact-title" lines={[copy.line1, copy.line2]} />
        <p className="public-contact-description">{copy.description}</p>
        {state === "loading" ? <p>{copy.loading}</p> : null}
        {state === "error" ? (
          <p className="public-contact-error" role="alert">
            {copy.error}
          </p>
        ) : null}
        {state === "success" ? (
          <p className="owner-response-success" role="status">
            {copy.success}
          </p>
        ) : null}
        {state === "ready" && inspection ? (
          <>
            <dl className="owner-response-summary">
              <div>
                <dt>{copy.vehicle}</dt>
                <dd>•••• {inspection.vehiclePlateLast4}</dd>
              </div>
              <div>
                <dt>{copy.callerMessage}</dt>
                <dd>{inspection.callerMessage}</dd>
              </div>
            </dl>
            <fieldset className="owner-response-options">
              <legend>{copy.eyebrow}</legend>
              {Object.entries(copy.replies).map(([code, label]) => (
                <label key={code}>
                  <input
                    aria-label={label}
                    checked={selected === code}
                    name="owner-reply"
                    onChange={() => setSelected(code)}
                    type="radio"
                  />
                  <span>{label}</span>
                </label>
              ))}
              <label>
                <input
                  aria-label={copy.customLabel}
                  checked={selected === "CUSTOM"}
                  name="owner-reply"
                  onChange={() => setSelected("CUSTOM")}
                  type="radio"
                />
                <span>{copy.customLabel}</span>
              </label>
            </fieldset>
            {selected === "CUSTOM" ? (
              <textarea
                aria-label={copy.customLabel}
                maxLength={200}
                onChange={(event) => setCustom(event.target.value)}
                value={custom}
              />
            ) : null}
            <button
              type="button"
              className="public-contact-primary"
              disabled={selected === "CUSTOM" && custom.trim().length === 0}
              onClick={() => void submit()}
            >
              {copy.submit}
            </button>
          </>
        ) : null}
        <p className="public-contact-security">{copy.security}</p>
      </section>
    </div>
  );
}
