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

// Recomputes a stream's vested and withdrawable amounts once per second from the
// current clock, so an active stream's balance visibly climbs in real time
// without re-fetching. Only a streaming stream changes over time, so the timer
// is skipped for pending, completed, and cancelled streams.
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
