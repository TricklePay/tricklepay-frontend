"use client";

import Link from "next/link";
import type { JSX } from "react";

import { useNow } from "@/hooks/use-now";
import { DEFAULT_TIME_FORMAT_OPTIONS, formatTokenAmount } from "@/lib/format";
import { buildWithdrawalTimeline, TIMELINE_DAYS } from "@/lib/withdrawal-timeline";
import type { StreamView } from "@/types/stream";

/**
 * Text timeline of the next 30 days of cliffs and ends across incoming
 * streams, with the projected withdrawable amount at each date. A native
 * disclosure and an ordered list keep it keyboard and screen reader friendly.
 */
export function WithdrawalTimeline({
  streams,
  walletAddress,
}: {
  streams: StreamView[];
  walletAddress: string;
}): JSX.Element | null {
  const now = useNow();
  const entries = buildWithdrawalTimeline(streams, walletAddress, BigInt(Math.floor(now / 1000)));
  if (entries.length === 0) return null;

  return (
    <details className="mb-6 rounded border border-neutral-800 px-3 py-2 text-xs text-neutral-300">
      <summary className="cursor-pointer py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
        Upcoming withdrawals, next {TIMELINE_DAYS} days ({entries.length})
      </summary>
      <ol className="mt-2 space-y-2 border-l border-neutral-700 pl-3">
        {entries.map((entry) => (
          <li key={`${entry.streamId}-${entry.kind}`}>
            <time dateTime={new Date(Number(entry.time) * 1000).toISOString()} className="text-neutral-400">
              {new Date(Number(entry.time) * 1000).toLocaleString(undefined, DEFAULT_TIME_FORMAT_OPTIONS)}
            </time>{" "}
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase">
              {entry.kind === "cliff" ? "Cliff" : "Ends"}
            </span>{" "}
            <Link href={`/streams/${entry.streamId}`} className="font-mono underline underline-offset-2">
              #{entry.streamId}
            </Link>
            : {formatTokenAmount(entry.withdrawable.toString(), entry.token)} withdrawable
          </li>
        ))}
      </ol>
    </details>
  );
}
