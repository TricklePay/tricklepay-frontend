// Helpers for the dashboard's "withdraw all available" action.

import { formatTokenAmount } from "@/lib/format";
import type { StreamView } from "@/types/stream";

/** Incoming streams of this wallet that have something to withdraw right now. */
export function withdrawableStreams(streams: StreamView[], walletAddress: string): StreamView[] {
  return streams.filter((stream) => {
    if (stream.recipient !== walletAddress || stream.status !== "streaming") return false;
    try {
      return BigInt(stream.withdrawable) > 0n;
    } catch {
      return false;
    }
  });
}

/** Total withdrawable per token across the given streams, formatted for display. */
export function withdrawableTotals(streams: StreamView[]): string[] {
  const totals = new Map<string, bigint>();
  for (const stream of streams) {
    totals.set(stream.token, (totals.get(stream.token) ?? 0n) + BigInt(stream.withdrawable));
  }
  return [...totals.entries()].map(([token, amount]) => formatTokenAmount(amount.toString(), token));
}
