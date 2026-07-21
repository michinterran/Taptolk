"use client";

import { useId, useState } from "react";

const PRESETS = [10, 25, 50, 75, 100] as const;

export function QrQuantityControl({
  label,
  maxLabel,
  name = "quantity",
}: {
  label: string;
  maxLabel: string;
  name?: string;
}) {
  const id = useId();
  const [quantity, setQuantity] = useState(100);

  function update(next: number) {
    setQuantity(Math.max(1, Math.min(100, next)));
  }

  return (
    <div className="qr-quantity-control">
      <label htmlFor={id}>{label}</label>
      <div className="qr-quantity-control__row">
        <button type="button" aria-label={`${label} -`} onClick={() => update(quantity - 1)}>
          −
        </button>
        <input
          id={id}
          max={100}
          min={1}
          name={name}
          onChange={(event) => update(Number(event.target.value))}
          required
          type="number"
          value={quantity}
        />
        <button type="button" aria-label={`${label} +`} onClick={() => update(quantity + 1)}>
          +
        </button>
        <select
          aria-label={maxLabel}
          onChange={(event) => update(Number(event.target.value))}
          value={quantity}
        >
          {PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset}
            </option>
          ))}
        </select>
      </div>
      <small>{maxLabel}</small>
    </div>
  );
}
