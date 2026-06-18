"use client";

import { useState } from "react";
import { cancel, withdraw } from "@/lib/contract";
import type { StreamView } from "@/types/stream";

interface Props {
  stream: StreamView;
  walletAddress: string | null;
  onComplete: () => void;
}

export function StreamActions({ stream, walletAddress, onComplete }: Props) {
  const [busy, setBusy] = useState<"withdraw" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!walletAddress) return null;
  const caller = walletAddress;

  const isRecipient = caller === stream.recipient;
  const isSender = caller === stream.sender;
  const canWithdraw = isRecipient && stream.status !== "pending";
  const canCancel = isSender && stream.status !== "cancelled" && stream.status !== "completed";

  if (!canWithdraw && !canCancel) return null;

  async function run(action: "withdraw" | "cancel") {
    setBusy(action);
    setError(null);
    try {
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
      <div className="flex gap-3">
        {canWithdraw && (
          <button
            onClick={() => void run("withdraw")}
            disabled={busy !== null}
            className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
          >
            {busy === "withdraw" ? "Withdrawing..." : "Withdraw"}
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => void run("cancel")}
            disabled={busy !== null}
            className="rounded border border-red-900 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
          >
            {busy === "cancel" ? "Cancelling..." : "Cancel stream"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
