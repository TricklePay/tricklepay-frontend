"use client";

import { type JSX, useRef, useState } from "react";

import { TransactionTimeoutError, withdraw } from "@/lib/contract";
import { TX_FAILED_WITHDRAW_MESSAGE } from "@/lib/contract-messages";
import { formatTokenAmount } from "@/lib/format";
import { withdrawableStreams, withdrawableTotals } from "@/lib/withdraw-all";
import type { StreamView } from "@/types/stream";

type Outcome = { state: "queued" | "running" | "done" | "skipped" } | { state: "failed"; message: string };

const buttonClass =
  "inline-flex items-center justify-center min-h-[44px] rounded border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:opacity-40";

/**
 * Queues one withdrawal per stream with something available, one at a time
 * (only one invocation can be in flight). Each transaction still goes through
 * the wallet's signing prompt, and the queue can be cancelled between streams.
 */
export function WithdrawAll({
  streams,
  walletAddress,
  onComplete,
}: {
  streams: StreamView[];
  walletAddress: string;
  onComplete: () => void;
}): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [queue, setQueue] = useState<StreamView[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const cancelRequested = useRef(false);

  const available = withdrawableStreams(streams, walletAddress);
  // Keep showing the queue after it ran, since the refreshed list will drop its streams.
  const listed = running || Object.keys(outcomes).length > 0 ? queue : available;
  if (!open && available.length === 0) return null;

  const begin = () => {
    setQueue(available);
    setOutcomes(Object.fromEntries(available.map((s) => [s.id, { state: "queued" } as Outcome])));
    setOpen(true);
  };

  const start = async () => {
    if (running) return;
    cancelRequested.current = false;
    setRunning(true);
    for (const stream of queue) {
      if (cancelRequested.current) {
        setOutcomes((prev) => ({ ...prev, [stream.id]: { state: "skipped" } }));
        continue;
      }
      setOutcomes((prev) => ({ ...prev, [stream.id]: { state: "running" } }));
      try {
        await withdraw(walletAddress, BigInt(stream.id));
        setOutcomes((prev) => ({ ...prev, [stream.id]: { state: "done" } }));
      } catch (err) {
        const message =
          err instanceof TransactionTimeoutError
            ? "Confirmation timed out. Check the stream before retrying."
            : err instanceof Error
              ? err.message
              : TX_FAILED_WITHDRAW_MESSAGE;
        setOutcomes((prev) => ({ ...prev, [stream.id]: { state: "failed", message } }));
      }
    }
    setRunning(false);
    onComplete();
  };

  const finished = !running && Object.values(outcomes).some((o) => o.state !== "queued");

  return (
    <section aria-label="Withdraw from several streams" className="mb-6">
      {!open ? (
        <button type="button" onClick={begin} className={buttonClass}>
          Withdraw all available ({available.length})
        </button>
      ) : (
        <div className="rounded border border-neutral-800 p-3 text-xs text-neutral-300">
          <p className="mb-2">
            {listed.length} {listed.length === 1 ? "stream" : "streams"}, total{" "}
            <span className="font-medium tabular-nums text-neutral-100">
              {withdrawableTotals(listed).join(" + ")}
            </span>
            . You will be asked to sign each withdrawal.
          </p>
          <ul className="mb-3 space-y-1">
            {listed.map((stream) => {
              const outcome = outcomes[stream.id];
              return (
                <li key={stream.id} className="flex flex-wrap gap-2">
                  <span className="font-mono">#{stream.id}</span>
                  <span className="tabular-nums">{formatTokenAmount(stream.withdrawable, stream.token)}</span>
                  <span role="status" className="text-neutral-500">
                    {outcome?.state === "failed" ? `Failed: ${outcome.message}` : (outcome?.state ?? "queued")}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            {!finished && (
              <button type="button" onClick={start} disabled={running} className={buttonClass}>
                {running ? "Withdrawing..." : "Start"}
              </button>
            )}
            {running && (
              <button
                type="button"
                onClick={() => {
                  cancelRequested.current = true;
                }}
                className={buttonClass}
              >
                Cancel queue
              </button>
            )}
            {!running && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQueue([]);
                  setOutcomes({});
                }}
                className={buttonClass}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
