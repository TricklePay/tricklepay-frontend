"use client";

import { useEffect, useState } from "react";
import { cancel, withdraw, withdrawAmount } from "@/lib/contract";
import { useAccrual } from "@/hooks/use-accrual";
import { config } from "@/lib/config";
import { txExplorerUrl } from "@/lib/explorer";
import { formatAmount, formatTime } from "@/lib/format";
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

// Parses a human decimal amount (e.g. "12.5") into 7-decimal base units,
// matching the convention in create-form.tsx. Returns null on invalid input.
function parseAmount(human: string): bigint | null {
  const trimmed = human.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0000000").slice(0, 7);
  try {
    return BigInt(whole || "0") * 10_000_000n + BigInt(fracPadded);
  } catch {
    return null;
  }
}

export function StreamActions({ stream, walletAddress, onComplete }: Props) {
  const [busy, setBusy] = useState<"withdraw" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const accrual = useAccrual(stream);

  // Keep the amount input in sync with the live withdrawable balance so the
  // default is always "withdraw everything available" without the user having
  // to type anything. Only reset when the field is still showing the previous
  // default (i.e. has not been manually edited to something else).
  useEffect(() => {
    const currentDefault = formatAmount(accrual.withdrawable.toString());
    setAmountInput((prev) => {
      // If the field is empty or already shows a stale default, update it.
      // If the user has typed a custom value, leave it alone.
      const prevParsed = parseAmount(prev);
      const prevWasDefault =
        prev === "" ||
        (prevParsed !== null &&
          prevParsed === parseAmount(formatAmount(accrual.withdrawable.toString())));
      return prevWasDefault ? currentDefault : prev;
    });
  }, [accrual.withdrawable]);

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

  function validateAmount(): bigint | null {
    const parsed = parseAmount(amountInput);
    if (parsed === null || parsed <= 0n) {
      setAmountError("Enter a valid amount greater than zero.");
      return null;
    }
    if (parsed > accrual.withdrawable) {
      setAmountError(
        `Amount exceeds withdrawable balance (${formatAmount(accrual.withdrawable.toString())}).`,
      );
      return null;
    }
    setAmountError(null);
    return parsed;
  }

  async function runWithdraw() {
    const amount = validateAmount();
    if (amount === null) return;

    setBusy("withdraw");
    setError(null);
    setLastTxHash(null);
    try {
      const streamId = BigInt(stream.id);
      // Use the full-balance shortcut when the user hasn't changed the amount,
      // avoiding an unnecessary i128 argument on the common path.
      const hash =
        amount === accrual.withdrawable
          ? await withdraw(caller, streamId)
          : await withdrawAmount(caller, streamId, amount);
      setLastTxHash(hash);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to withdraw.");
    } finally {
      setBusy(null);
    }
  }

  async function runCancel() {
    setBusy("cancel");
    setError(null);
    setLastTxHash(null);
    try {
      const hash = await cancel(caller, BigInt(stream.id));
      setLastTxHash(hash);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel.");
    } finally {
      setBusy(null);
      setConfirmingCancel(false);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {isRecipient && (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-400">
                Amount{" "}
                <span className="text-neutral-600">
                  (max {formatAmount(accrual.withdrawable.toString())})
                </span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setAmountError(null);
                }}
                disabled={busy !== null || nothingToWithdraw}
                className="w-44 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none disabled:opacity-50"
                aria-label="Withdrawal amount"
              />
            </label>
            <button
              onClick={() => void runWithdraw()}
              disabled={busy !== null || nothingToWithdraw}
              className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
            >
              {busy === "withdraw" ? "Withdrawing..." : "Withdraw"}
            </button>
          </div>
          {amountError && <p className="text-sm text-red-400">{amountError}</p>}
          {nothingToWithdraw && (
            <p className="text-sm text-neutral-500">{blockedReason(stream)}</p>
          )}
        </div>
      )}

      {canCancel && !confirmingCancel && (
        <button
          onClick={() => setConfirmingCancel(true)}
          disabled={busy !== null}
          className="self-start rounded border border-red-900 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
        >
          Cancel stream
        </button>
      )}

      {canCancel && confirmingCancel && (
        <div
          role="alertdialog"
          aria-labelledby="cancel-confirm-heading"
          className="flex flex-col gap-3 self-start rounded border border-red-900 bg-red-950/20 p-4"
        >
          <p id="cancel-confirm-heading" className="text-sm text-red-200">
            Cancel this stream? Streaming stops immediately and any unstreamed
            balance returns to the sender. This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void runCancel()}
              disabled={busy !== null}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {busy === "cancel" ? "Cancelling..." : "Yes, cancel stream"}
            </button>
            <button
              onClick={() => setConfirmingCancel(false)}
              disabled={busy !== null}
              className="rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
            >
              Keep streaming
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {lastTxHash && (
        <p className="text-sm text-neutral-500">
          Confirmed.{" "}
          <a
            href={txExplorerUrl(lastTxHash, config.network)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-300 underline hover:text-neutral-100"
          >
            View transaction on Stellar Expert
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
    </div>
  );
}
