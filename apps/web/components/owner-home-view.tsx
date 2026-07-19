"use client";

import { SemanticHeading } from "@taptolk/ui";
import { useEffect, useState } from "react";
import type { OwnerActivationCopy } from "../content/owner-activation-copy";
import type { AppLocale } from "../i18n/config";
import { getOwnerDeviceHash } from "../owner/owner-device-client";

interface OwnerVehicle {
  plateLast4: string;
  qrStatus: "ACTIVE" | "SUSPENDED";
  siteId: string;
  vehicleId: string;
}

export function OwnerHomeView({ copy, locale }: { copy: OwnerActivationCopy; locale: AppLocale }) {
  const [vehicles, setVehicles] = useState<readonly OwnerVehicle[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    void getOwnerDeviceHash()
      .then((deviceHash) =>
        fetch("/api/owner/vehicles", {
          body: JSON.stringify({ deviceHash, locale }),
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("OWNER_SESSION_UNAVAILABLE");
        }
        return response.json() as Promise<{ data: { vehicles: OwnerVehicle[] } }>;
      })
      .then((payload) => {
        if (active) {
          setVehicles(payload.data.vehicles);
        }
      })
      .catch(() => {
        if (active) {
          setUnavailable(true);
        }
      });
    return () => {
      active = false;
    };
  }, [locale]);

  return (
    <section className="owner-activation-card" aria-live="polite">
      {/* biome-ignore lint/performance/noImgElement: the immutable logo must be served byte-for-byte */}
      <img className="owner-activation-logo" src="/brand/taptolk-logo.png" alt="Taptolk" />
      <SemanticHeading className="owner-activation-title" lines={[copy.vehiclesTitle]} />
      {unavailable ? <p className="owner-activation-error">{copy.errorUnavailable}</p> : null}
      {vehicles === null && !unavailable ? (
        <p className="owner-activation-notice">{copy.loading}</p>
      ) : null}
      {vehicles?.length === 0 ? <p>{copy.vehiclesEmpty}</p> : null}
      {vehicles && vehicles.length > 0 ? (
        <ul className="owner-vehicle-list">
          {vehicles.map((vehicle) => (
            <li key={vehicle.vehicleId}>
              <span>{copy.vehiclePlate}</span>
              <strong>•••• {vehicle.plateLast4}</strong>
              <small>{vehicle.qrStatus}</small>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
