"use client";

import type { JSX } from "react";

import { useNow } from "@/hooks/use-now";
import { formatTokenAmount, resolveTokenMetadata } from "@/lib/format";
import { vestingCurvePoints } from "@/lib/vesting-curve";
import type { StreamView } from "@/types/stream";

// SVG viewport dimensions (unitless).
const W = 400;
const H = 160;
// Inner plot area insets.
const PAD = { top: 12, right: 16, bottom: 28, left: 8 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

interface Props {
  stream: StreamView;
}

/**
 * Draws the vesting curve for a stream as an inline SVG.
 *
 * - The curve includes a cliff step when the stream has one.
 * - A vertical "now" marker tracks the current time.
 * - A visually hidden `<figcaption>` provides a text summary for screen
 *   readers that describes start, cliff (if any), end, and current progress.
 */
export function VestingCurve({ stream }: Props): JSX.Element {
  // Re-render once per second so the "now" marker advances while the stream
  // is active; useNow() already handles this.
  const nowSec = Math.floor(useNow() / 1000);

  const totalAmount = BigInt(stream.totalAmount);
  const startTime = BigInt(stream.startTime);
  const endTime = BigInt(stream.endTime);
  const cliffTime = BigInt(stream.cliffTime);
  const hasCliff = cliffTime > startTime;

  // Chart x-axis spans from (startTime − a small margin) to endTime.
  const tMin = Number(startTime) - 1;
  const tMax = Number(endTime);
  const tRange = tMax - tMin || 1;

  // Chart y-axis spans from 0 to totalAmount.
  const vMax = Number(totalAmount) || 1;

  // Map a (t, vested) pair to SVG coordinates.
  function toSvg(t: number, vested: bigint): { x: number; y: number } {
    const x = PAD.left + ((t - tMin) / tRange) * PLOT_W;
    const y = PAD.top + PLOT_H - (Number(vested) / vMax) * PLOT_H;
    return { x, y };
  }

  const points = vestingCurvePoints(totalAmount, startTime, endTime, cliffTime);

  // Build an SVG polyline points string.
  const polylinePoints = points
    .map(({ t, vested }) => {
      const { x, y } = toSvg(t, vested);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  // "Now" marker — clamp to the chart's x range.
  const nowClamped = Math.min(Math.max(nowSec, tMin), tMax);
  const { x: nowX } = toSvg(nowClamped, 0n);

  // Accessible summary text.
  const startLabel = new Date(Number(startTime) * 1000).toLocaleDateString();
  const endLabel = new Date(Number(endTime) * 1000).toLocaleDateString();
  const progressPct = Math.round(stream.progress / 100);
  const cliffLabel = hasCliff
    ? ` There is a cliff at ${new Date(Number(cliffTime) * 1000).toLocaleDateString()}, before which nothing vests.`
    : "";
  // Same decimals and symbol as the amounts shown on the page.
  const totalLabel = `${formatTokenAmount(stream.totalAmount, stream.token)}${
    resolveTokenMetadata(stream.token) ? "" : " tokens"
  }`;
  const summaryText =
    `Linear vesting schedule from ${startLabel} to ${endLabel}.${cliffLabel}` +
    ` Total: ${totalLabel}. Current progress: ${progressPct}%.`;

  return (
    <figure aria-label="Vesting curve chart" className="my-6">
      {/* Visually hidden text summary for screen readers */}
      <figcaption className="sr-only">{summaryText}</figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        className="w-full overflow-visible rounded-lg border border-neutral-800 bg-neutral-900/60"
        style={{ maxHeight: "200px" }}
      >
        {/* Baseline */}
        <line
          x1={PAD.left}
          y1={PAD.top + PLOT_H}
          x2={PAD.left + PLOT_W}
          y2={PAD.top + PLOT_H}
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="1"
          className="text-neutral-500"
        />

        {/* Cliff shaded region */}
        {hasCliff && (
          <rect
            x={toSvg(Number(startTime), 0n).x}
            y={PAD.top}
            width={toSvg(Number(cliffTime), 0n).x - toSvg(Number(startTime), 0n).x}
            height={PLOT_H}
            fill="currentColor"
            fillOpacity="0.06"
            className="text-amber-400"
          />
        )}

        {/* Area fill under the curve */}
        <polygon
          points={[
            `${toSvg(tMin, 0n).x.toFixed(2)},${(PAD.top + PLOT_H).toFixed(2)}`,
            ...points.map(({ t, vested }) => {
              const { x, y } = toSvg(t, vested);
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            }),
            `${toSvg(tMax, 0n).x.toFixed(2)},${(PAD.top + PLOT_H).toFixed(2)}`,
          ].join(" ")}
          fill="currentColor"
          fillOpacity="0.08"
          className="text-indigo-400"
        />

        {/* Vesting curve line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="text-indigo-400"
        />

        {/* "Now" marker */}
        {nowSec >= tMin && nowSec <= tMax && (
          <>
            <line
              x1={nowX}
              y1={PAD.top}
              x2={nowX}
              y2={PAD.top + PLOT_H}
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 2"
              className="text-neutral-400"
            />
            <text
              x={nowX + 3}
              y={PAD.top + 9}
              fontSize="8"
              fill="currentColor"
              className="text-neutral-500"
            >
              now
            </text>
          </>
        )}

        {/* X-axis labels: start and end */}
        <text
          x={toSvg(Number(startTime), 0n).x}
          y={H - 6}
          fontSize="8"
          textAnchor="middle"
          fill="currentColor"
          className="text-neutral-500"
        >
          {new Date(Number(startTime) * 1000).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
        <text
          x={toSvg(tMax, 0n).x}
          y={H - 6}
          fontSize="8"
          textAnchor="end"
          fill="currentColor"
          className="text-neutral-500"
        >
          {new Date(Number(endTime) * 1000).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
      </svg>
    </figure>
  );
}
