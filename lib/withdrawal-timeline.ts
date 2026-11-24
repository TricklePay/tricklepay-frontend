// Upcoming cash-in dates for a wallet's incoming streams. Reuses
// projectVesting, the same vesting math as the stream detail page.

import { projectVesting } from "@/lib/vesting-projection";
import type { StreamView } from "@/types/stream";

export const TIMELINE_DAYS = 30;

export interface TimelineEntry {
  streamId: string;
  token: string;
  kind: "cliff" | "end";
  /** Unix seconds */
  time: bigint;
  /** Projected withdrawable amount in base units at that time. */
  withdrawable: bigint;
}

/** Cliffs and ends of the wallet's incoming streams within the next 30 days, earliest first. */
export function buildWithdrawalTimeline(
  streams: StreamView[],
  walletAddress: string,
  nowSeconds: bigint,
): TimelineEntry[] {
  const horizon = nowSeconds + BigInt(TIMELINE_DAYS * 24 * 60 * 60);
  const entries: TimelineEntry[] = [];

  for (const stream of streams) {
    if (stream.recipient !== walletAddress) continue;
    if (stream.status !== "pending" && stream.status !== "streaming") continue;

    const start = BigInt(stream.startTime);
    const cliff = BigInt(stream.cliffTime);
    const end = BigInt(stream.endTime);
    const marks: Array<[TimelineEntry["kind"], bigint]> = [];
    // A cliff equal to the start means the stream has none.
    if (cliff !== start) marks.push(["cliff", cliff]);
    marks.push(["end", end]);

    for (const [kind, time] of marks) {
      if (time <= nowSeconds || time > horizon) continue;
      entries.push({
        streamId: stream.id,
        token: stream.token,
        kind,
        time,
        withdrawable: projectVesting(stream, time).withdrawable,
      });
    }
  }

  return entries.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}
