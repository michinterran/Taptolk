"use client";

import type { HTMLAttributes } from "react";
import { useEffect, useId, useRef, useState } from "react";

type DaumPostcodeResult = {
  address?: string;
  jibunAddress?: string;
  roadAddress?: string;
  zonecode?: string;
};

declare global {
  interface Window {
    daum?: {
      Postcode?: new (options: {
        oncomplete: (data: DaumPostcodeResult) => void;
        width?: string;
      }) => {
        embed: (element: HTMLElement) => void;
      };
    };
  }
}

export type AddressValue = {
  jibunAddress?: string;
  roadAddress?: string;
  zonecode?: string;
};

export type AddressFieldLabels = {
  close: string;
  fallbackHint: string;
  jibunAddress: string;
  open: string;
  roadAddress: string;
  title: string;
  zonecode: string;
};

export type AddressFieldProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  labels: AddressFieldLabels;
  onChange: (value: AddressValue) => void;
  scriptSrc: string;
  value: AddressValue;
};

export function AddressField({
  className = "",
  labels,
  onChange,
  scriptSrc,
  value,
  ...props
}: AddressFieldProps) {
  const embedRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const titleId = useId();

  function openSearch() {
    setIsOpen(true);
  }

  function closeSearch() {
    setIsOpen(false);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.daum?.Postcode) {
      setIsReady(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
    const script = existing ?? document.createElement("script");

    function markReady() {
      setIsReady(Boolean(window.daum?.Postcode));
    }

    script.addEventListener("load", markReady);
    script.addEventListener("error", markReady);

    if (!existing) {
      script.src = scriptSrc;
      script.async = true;
      document.head.appendChild(script);
    }

    return () => {
      script.removeEventListener("load", markReady);
      script.removeEventListener("error", markReady);
    };
  }, [scriptSrc]);

  useEffect(() => {
    if (!isOpen || !isReady || !embedRef.current || !window.daum?.Postcode) {
      return;
    }

    embedRef.current.replaceChildren();
    new window.daum.Postcode({
      oncomplete: (data) => {
        const nextValue: AddressValue = {};

        if (data.jibunAddress) {
          nextValue.jibunAddress = data.jibunAddress;
        }

        const roadAddress = data.roadAddress || data.address;

        if (roadAddress) {
          nextValue.roadAddress = roadAddress;
        }

        if (data.zonecode) {
          nextValue.zonecode = data.zonecode;
        }

        onChange(nextValue);
        setIsOpen(false);
      },
      width: "100%",
    }).embed(embedRef.current);
  }, [isOpen, isReady, onChange]);

  return (
    <div className={`tt-address-field ${className}`.trim()} {...props}>
      <dl className="tt-address-field__values">
        <div>
          <dt>{labels.zonecode}</dt>
          <dd>{value.zonecode || "—"}</dd>
        </div>
        <div>
          <dt>{labels.roadAddress}</dt>
          <dd>{value.roadAddress || "—"}</dd>
        </div>
        <div>
          <dt>{labels.jibunAddress}</dt>
          <dd>{value.jibunAddress || "—"}</dd>
        </div>
      </dl>
      <button className="tt-button tt-button--secondary" onClick={openSearch} type="button">
        {labels.open}
      </button>
      {isOpen ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="tt-address-field__dialog"
          role="dialog"
        >
          <div className="tt-address-field__panel">
            <div className="tt-address-field__header">
              <h2 id={titleId}>{labels.title}</h2>
              <button
                className="tt-button tt-button--ghost tt-button--compact"
                onClick={closeSearch}
                type="button"
              >
                {labels.close}
              </button>
            </div>
            {isReady ? (
              <div className="tt-address-field__embed" ref={embedRef} />
            ) : (
              <p className="tt-address-field__fallback">{labels.fallbackHint}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
