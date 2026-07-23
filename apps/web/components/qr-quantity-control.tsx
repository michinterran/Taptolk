"use client";

import {
  clampQrBatchTotal,
  planQrBatchOrder,
  type QrBatchPreset,
  type QrSiteCapacity,
} from "@taptolk/domain";
import { type ChangeEvent, type MouseEvent, useId, useState } from "react";
import type { AppLocale } from "../i18n/config";

const STEP = 10;

export interface QrQuantityLabels {
  contextContract: string;
  contextLastOrder: string;
  contextStock: string;
  decrease: string;
  empty: string;
  eta: string;
  increase: string;
  presetContract: string;
  presetContractDouble: string;
  presetFixed: string;
  recommend: string;
  recommendWhy: string;
  scaleContract: string;
  slider: string;
  snapAligned: string;
  snapDown: string;
  snapUp: string;
  splitNotice: string;
  statBatches: string;
  statEta: string;
  statLast: string;
  statPerBatch: string;
  total: string;
  unit: string;
  vizCollapsed: string;
  vizNote: string;
  vizTitle: string;
  warnFills: string;
  warnOver: string;
}

export interface QrLastOrder {
  orderedAt: string;
  quantity: number;
}

interface QrQuantityControlProps {
  capacity?: QrSiteCapacity;
  defaultQuantity?: number;
  labels: QrQuantityLabels;
  lastOrder?: QrLastOrder;
  locale: AppLocale;
  name?: string;
}

/** Fills `{token}` placeholders from the typed locale dictionary. */
function format(template: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, value),
    template,
  );
}

const EMPTY_VALUE = "—";

/** 1-based batch numbers, so each full-batch segment keys off its own position in the split. */
function batchNumbers(count: number): readonly number[] {
  const numbers: number[] = [];
  for (let batchNumber = 1; batchNumber <= count; batchNumber += 1) {
    numbers.push(batchNumber);
  }
  return numbers;
}

export function QrQuantityControl({
  capacity = { contractVehicleLimit: null, unassignedStock: 0 },
  defaultQuantity = 100,
  labels,
  lastOrder,
  locale,
  name = "quantity",
}: QrQuantityControlProps) {
  const inputId = useId();
  const sliderId = useId();
  const [quantity, setQuantity] = useState(() => clampQrBatchTotal(defaultQuantity));

  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const plan = planQrBatchOrder(quantity, capacity);
  const { contractVehicleLimit, unassignedStock } = capacity;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setQuantity(clampQrBatchTotal(Number(event.target.value)));
  }

  function handleDecrease(): void {
    setQuantity(clampQrBatchTotal(quantity - STEP));
  }

  function handleIncrease(): void {
    setQuantity(clampQrBatchTotal(quantity + STEP));
  }

  function handleRecommend(): void {
    setQuantity(plan.recommendedTotal ?? quantity);
  }

  /** Shared by the preset and snap buttons; each carries its target total in `data-total`. */
  function handleJumpTo(event: MouseEvent<HTMLButtonElement>): void {
    const target = Number(event.currentTarget.dataset.total);
    setQuantity(clampQrBatchTotal(target));
  }

  function presetLabel(preset: QrBatchPreset): string {
    const value = number.format(preset.value);
    if (preset.kind === "CONTRACT") {
      return format(labels.presetContract, { value });
    }
    if (preset.kind === "CONTRACT_DOUBLE") {
      return format(labels.presetContractDouble, { value });
    }
    return format(labels.presetFixed, { value });
  }

  return (
    <div className="qr-quantity">
      <p className="qr-quantity__notice">{labels.splitNotice}</p>

      <div className="qr-quantity__grid">
        <div className="qr-quantity__box">
          <label className="qr-quantity__label" htmlFor={inputId}>
            {labels.total}
          </label>

          <div className="qr-quantity__row">
            <button
              aria-label={labels.decrease}
              className="qr-quantity__step"
              onClick={handleDecrease}
              type="button"
            >
              −
            </button>
            <div className="qr-quantity__big">
              <input
                id={inputId}
                inputMode="numeric"
                max={plan.sliderMax}
                min={0}
                name={name}
                onChange={handleChange}
                required
                type="number"
                value={quantity}
              />
              <span className="qr-quantity__unit">{labels.unit}</span>
            </div>
            <button
              aria-label={labels.increase}
              className="qr-quantity__step"
              onClick={handleIncrease}
              type="button"
            >
              +
            </button>
          </div>

          <div className="qr-quantity__sliderwrap">
            <input
              aria-label={labels.slider}
              className="qr-quantity__slider"
              id={sliderId}
              max={plan.sliderMax}
              min={0}
              onChange={handleChange}
              step={STEP}
              type="range"
              value={Math.min(quantity, plan.sliderMax)}
            />
            <div className="qr-quantity__scale">
              <span>{number.format(0)}</span>
              {contractVehicleLimit === null ? null : (
                <span>
                  {format(labels.scaleContract, {
                    value: number.format(contractVehicleLimit),
                  })}
                </span>
              )}
              <span>{number.format(plan.sliderMax)}</span>
            </div>
          </div>

          {plan.recommendedTotal === null || contractVehicleLimit === null ? null : (
            <div className="qr-quantity__recommend">
              <button className="qr-quantity__rec" onClick={handleRecommend} type="button">
                {format(labels.recommend, { value: number.format(plan.recommendedTotal) })}
              </button>
              <span className="qr-quantity__recwhy">
                {format(labels.recommendWhy, {
                  limit: number.format(contractVehicleLimit),
                  stock: number.format(unassignedStock),
                })}
              </span>
            </div>
          )}

          {plan.presets.length > 0 ? (
            <div className="qr-quantity__presets">
              {plan.presets.map((preset) => (
                <button
                  className="qr-quantity__preset"
                  data-total={preset.value}
                  key={`${preset.kind}-${preset.value}`}
                  onClick={handleJumpTo}
                  type="button"
                >
                  {presetLabel(preset)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <dl className="qr-quantity__stats">
          <div>
            <dt>{labels.statBatches}</dt>
            <dd>{number.format(plan.batchCount)}</dd>
          </div>
          <div>
            <dt>{labels.statPerBatch}</dt>
            <dd>{number.format(plan.perBatchMax)}</dd>
          </div>
          <div>
            <dt>{labels.statLast}</dt>
            <dd>{plan.lastBatchSize === null ? EMPTY_VALUE : number.format(plan.lastBatchSize)}</dd>
          </div>
          <div>
            <dt>{labels.statEta}</dt>
            <dd>
              {plan.estimatedMinutes === null
                ? EMPTY_VALUE
                : format(labels.eta, { minutes: number.format(plan.estimatedMinutes) })}
            </dd>
          </div>
        </dl>
      </div>

      <section className="qr-quantity__viz">
        <header>
          <strong>{labels.vizTitle}</strong>
          <span>
            {plan.total === 0
              ? ""
              : format(labels.vizNote, {
                  count: number.format(plan.batchCount),
                  max: number.format(plan.perBatchMax),
                  total: number.format(plan.total),
                })}
          </span>
        </header>

        <div className="qr-quantity__segs">
          {plan.total === 0 ? (
            <span className="qr-quantity__seg qr-quantity__seg--empty">{labels.empty}</span>
          ) : (
            <>
              {batchNumbers(plan.segments.drawn).map((batchNumber) => (
                <span className="qr-quantity__seg" key={`batch-${batchNumber}`}>
                  {number.format(plan.perBatchMax)}
                </span>
              ))}
              {plan.segments.collapsed > 0 ? (
                <span className="qr-quantity__seg qr-quantity__seg--more">
                  {format(labels.vizCollapsed, {
                    count: number.format(plan.segments.collapsed),
                  })}
                </span>
              ) : null}
              {plan.segments.partial === null ? null : (
                <span
                  className="qr-quantity__seg qr-quantity__seg--partial"
                  style={{ flexGrow: Math.max(0.35, plan.segments.partial / plan.perBatchMax) }}
                >
                  {number.format(plan.segments.partial)}
                </span>
              )}
            </>
          )}
        </div>

        {plan.snap === null ? null : (
          <div className="qr-quantity__snap">
            {plan.snap.kind === "ALIGNED" ? (
              <span className="qr-quantity__snapbtn qr-quantity__snapbtn--static">
                {format(labels.snapAligned, { max: number.format(plan.perBatchMax) })}
              </span>
            ) : (
              <>
                <button
                  className="qr-quantity__snapbtn"
                  data-total={plan.snap.downTo}
                  onClick={handleJumpTo}
                  type="button"
                >
                  {format(labels.snapDown, {
                    by: number.format(plan.snap.downBy),
                    count: number.format(plan.fullBatchCount),
                  })}
                </button>
                <button
                  className="qr-quantity__snapbtn"
                  data-total={plan.snap.upTo}
                  onClick={handleJumpTo}
                  type="button"
                >
                  {format(labels.snapUp, {
                    by: number.format(plan.snap.upBy),
                    max: number.format(plan.perBatchMax),
                  })}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <div aria-live="polite" className="qr-quantity__signal">
        {plan.capacitySignal === "OVER_CONTRACT" && contractVehicleLimit !== null ? (
          <p className="qr-quantity__warn">
            {format(labels.warnOver, {
              limit: number.format(contractVehicleLimit),
              over: number.format(plan.overBy),
            })}
          </p>
        ) : null}
        {plan.capacitySignal === "FILLS_CONTRACT" && contractVehicleLimit !== null ? (
          <p className="qr-quantity__info">
            {format(labels.warnFills, {
              limit: number.format(contractVehicleLimit),
              stock: number.format(unassignedStock),
            })}
          </p>
        ) : null}
      </div>

      <dl className="qr-quantity__context">
        <div>
          <dt>{labels.contextContract}</dt>
          <dd>
            {contractVehicleLimit === null ? EMPTY_VALUE : number.format(contractVehicleLimit)}
          </dd>
        </div>
        <div>
          <dt>{labels.contextStock}</dt>
          <dd>{number.format(unassignedStock)}</dd>
        </div>
        <div>
          <dt>{labels.contextLastOrder}</dt>
          <dd>
            {lastOrder === undefined
              ? EMPTY_VALUE
              : `${number.format(lastOrder.quantity)} · ${date.format(new Date(lastOrder.orderedAt))}`}
          </dd>
        </div>
      </dl>
    </div>
  );
}
