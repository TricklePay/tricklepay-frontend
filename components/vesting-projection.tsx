"use client";

import { type JSX, useState } from "react";

import { formatTokenAmount } from "@/lib/format";
import { parseDatetimeLocal, projectVesting } from "@/lib/vesting-projection";
import type { StreamView } from "@/types/stream";

interface Props {
  stream: StreamView;
}

/**
 * A small calculator on the stream detail page: choose a date and see how
 * much will have vested and be withdrawable at that moment.
 *
 * Dates before the stream start return 0; dates after the end return the
 * full amount. The existing vesting arithmetic handles all edge cases.
 */
export function VestingProjection({ stream }: Props): JSX.Element {
  const [dateInput, setDateInput] = useState("");

  const atTime = parseDatetimeLocal(dateInput);
  const result = atTime !== null ? projectVesting(stream, atTime) : null;

  // Determine a label for the result context.
  function resultLabel(): string {
    if (atTime === null) return "";
    const start = BigInt(stream.startTime);
    const end = BigInt(stream.endTime);
    if (atTime < start) return "Before stream starts — nothing vested yet.";
    if (atTime >= end) return "After stream ends — fully vested.";
    return "During the stream.";
  }

  return (
    <section
      aria-labelledby="projection-heading"
      className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-4"
    >
      <h2 id="projection-heading" className="mb-1 text-sm font-semibold text-neutral-200">
        Projection calculator
      </h2>
      <p className="mb-3 text-xs text-neutral-500">
        Choose a date to see the projected vested and withdrawable amounts at
        that time.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">Date and time</span>
        <input
          type="datetime-local"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          className="w-56 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          aria-describedby="projection-result"
        />
      </label>

      <div
        id="projection-result"
        aria-live="polite"
        className="mt-3 min-h-[3rem]"
      >
        {result !== null && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Context</dt>
              <dd className="text-neutral-300">{resultLabel()}</dd>
            </div>
            <div /> {/* spacer */}
            <div>
              <dt className="text-xs text-neutral-500">Vested at that time</dt>
              <dd className="font-mono tabular-nums text-neutral-100">
                {formatTokenAmount(result.vested.toString(), stream.token)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Withdrawable at that time</dt>
              <dd className="font-mono tabular-nums text-neutral-100">
                {formatTokenAmount(result.withdrawable.toString(), stream.token)}
              </dd>
            </div>
          </dl>
        )}
        {dateInput && result === null && (
          <p className="text-sm text-red-400">Invalid date.</p>
        )}
      </div>
    </section>
  );
}
