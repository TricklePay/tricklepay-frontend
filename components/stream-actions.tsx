"use client";

import { useState } from "react";
import { cancel, withdraw } from "@/lib/contract";
import { useAccrual } from "@/hooks/use-accrual";
import { useNetworkGuard } from "@/hooks/use-network-guard";
import { formatTime } from "@/lib/format";
import type { StreamView } from "@/types/stream";

interface Props {
  stream: StreamView;
  walletAddress: string | null;
  onComplete: () => void;
}

// Why a recipient cannot withdraw right now. A cliff is the case worth naming:
// the stream is visibly streaming and its vested figure is climbing, so without
// the date the disabled button looks like a bug rather than a schedule.
function blockedReason(stream: StreamView): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < BigInt(stream.startTime)) {
    return `Starts ${formatTime(stream.startTime)}.`;
  }
  if (now < BigInt(stream.cliffTime)) {
    return `Locked until the cliff on ${formatTime(stream.cliffTime)}.`;
  }
  if (BigInt(stream.withdrawn) >= BigInt(stream.totalAmount)) {
    return "Fully withdrawn.";
  }
  if (stream.cancelled) {
    return "This stream was cancelled.";
  }
  return "Nothing to withdraw yet.";
}

export function StreamActions({ stream, walletAddress, onComplete }: Props) {
  const [busy, setBusy] = useState<"withdraw" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accrual = useAccrual(stream);
  const { mismatch, walletNetwork, expectedNetwork } = useNetworkGuard();

  if (!walletAddress) return null;
  const caller = walletAddress;

  const isRecipient = caller === stream.recipient;
  const isSender = caller === stream.sender;
  const canCancel = isSender && stream.status !== "cancelled" && stream.status !== "completed";

  // Status alone is not enough: between start and cliff a stream is already
  // "streaming" while nothing has vested, and the contract rejects that
  // withdrawal with NothingToWithdraw. Gate on the amount itself so the button
  // never sends a transaction that is certain to revert.
  const nothingToWithdraw = accrual.withdrawable === 0n;

  if (!isRecipient && !canCancel) return null;

  async function run(action: "withdraw" | "cancel") {
    setBusy(action);
    setError(null);
    try {
      if (mismatch) {
        throw new Error(
          `Wrong network: wallet is on ${walletNetwork ?? "unknown"}, app expects ${expectedNetwork}. Switch networks in Freighter.`,
        );
      }
      const streamId = BigInt(stream.id);
      if (action === "withdraw") {
        await withdraw(caller, streamId);
      } else {
        await cancel(caller, streamId);
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {mismatch && (
        <p role="alert" className="rounded border border-red-700 bg-red-950/60 px-3 py-2 text-sm font-medium text-red-300">
          Wrong network: wallet is on <strong>{walletNetwork}</strong>, app expects{" "}
          <strong>{expectedNetwork}</strong>. Switch networks in Freighter to sign transactions.
        </p>
      )}
      <div className="flex gap-3">
        {isRecipient && (
          <button
            onClick={() => void run("withdraw")}
            disabled={busy !== null || nothingToWithdraw || mismatch}
            className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
          >
            {busy === "withdraw" ? "Withdrawing..." : "Withdraw"}
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => void run("cancel")}
            disabled={busy !== null || mismatch}
            className="rounded border border-red-900 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
          >
            {busy === "cancel" ? "Cancelling..." : "Cancel stream"}
          </button>
        )}
      </div>
      {isRecipient && nothingToWithdraw && !mismatch && (
        <p className="text-sm text-neutral-500">{blockedReason(stream)}</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
