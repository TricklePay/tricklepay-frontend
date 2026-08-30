"use client";

import { useEffect, useState } from "react";
import type { StreamView } from "@/types/stream";
import { vestedAmount, withdrawableAmount } from "@/lib/vesting";

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
    const interval = setInterval(() => setAccrual(computeAccrual(stream)), 1000);
    return () => clearInterval(interval);
  }, [stream]);

  return accrual;
}
