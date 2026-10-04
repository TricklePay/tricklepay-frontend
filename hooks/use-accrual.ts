"use client";

import { useEffect, useState } from "react";

import { vestedAmount, withdrawableAmount } from "@/lib/vesting";
import type { StreamView } from "@/types/stream";

// How often a streaming balance is recomputed. Vesting is per second on-chain,
// so a faster tick would re-render without the figure changing.
const ACCRUAL_TICK_MS = 1_000;

export interface Accrual {
  vested: bigint;
  withdrawable: bigint;
}

function computeAccrual(stream: StreamView): Accrual {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const vested = vestedAmount(
    BigInt(stream.totalAmount),
    BigInt(stream.startTime),
    BigInt(stream.endTime),
    BigInt(stream.cliffTime),
    now,
  );
  return { vested, withdrawable: withdrawableAmount(vested, BigInt(stream.withdrawn)) };
}

/**
 * Continuously recomputes a stream's vested and withdrawable amounts in real time.
 *
 * Why balances are interpolated locally
 * ----------------------------------------------------------------------------
 * The authoritative values for a vesting stream are derived from the ledger clock,
 * which is the source of truth for vesting. The contract computes the vested
 * amount as a function of the current ledger timestamp, not as a function of any
 * stored counter. Because that function is deterministic and linear, the frontend
 * can reproduce it exactly without asking the network for a fresh reading.
 *
 * Polling the API every second would impose a constant, continuous load on the
 * backend and the Sorban RPC endpoints for every open stream in every open tab,
 * while producing the same result that local arithmetic already provides. The
 * interpolation is therefore a deliberate trade-off between accuracy and load:
 * the displayed figure advances smoothly and instantly between fetches, while
 * the network is only consulted on a slower cadence.
 *
 * How often authoritative data is fetched
 * ----------------------------------------------------------------------------
 * Authoritative stream data is fetched by the surrounding data layer on a coarse
 * interval (on the order of tens of seconds) and on demand after actions such as
 * withdrawals. Between those fetches, this hook advances the balance locally.
 * The next authoritative read replaces the interpolated value, so any drift can
 * only persist for the duration of one fetch interval.
 *
 * The ledger clock is the source of truth
 * ----------------------------------------------------------------------------
 * The client only approximates the ledger clock with the browser's wall clock.
 * When the two disagree, the ledger clock wins: the contract enforces the real
 * vested amount at withdrawal time, and the next fetch reconciles the UI to the
 * on-chain figure. The interpolated value is a presentation hint, never an
 * authority for what can actually be withdrawn.
 *
 * This hook mirrors the contract's vesting arithmetic client-side so balances
 * advance on screen every second without re-fetching from the API. For a stream
 * with status "streaming", the hook sets a 1-second interval timer to recompute
 * the accrual using the current wall-clock time. For streams with other statuses
 * (pending, completed, cancelled), the hook computes once and does not tick,
 * because those streams' balances do not change over time.
 *
 * The 1-second tick interval balances visual responsiveness with performance:
 * fast enough that users see continuous progress, slow enough to avoid unnecessary
 * re-renders.
 *
 * @param stream - The stream to track
 * @returns Current vested and withdrawable amounts in base units (stroops)
 */
export function useAccrual(stream: StreamView): Accrual {
  const [accrual, setAccrual] = useState<Accrual>(() => computeAccrual(stream));

  useEffect(() => {
    setAccrual(computeAccrual(stream));
    if (stream.status !== "streaming") return;
    const interval = setInterval(() => setAccrual(computeAccrual(stream)), ACCRUAL_TICK_MS);
    return () => clearInterval(interval);
  }, [stream]);

  return accrual;
}
