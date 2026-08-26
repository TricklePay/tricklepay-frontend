"use client";

import { useEffect, useState } from "react";
import { cancel, withdraw, withdrawAmount, confirmTransaction, TransactionTimeoutError, type TxStage } from "@/lib/contract";
import { TransactionProgress } from "@/components/transaction-progress";
import { useAccrual } from "@/hooks/use-accrual";
import { config } from "@/lib/config";
import { txExplorerUrl } from "@/lib/explorer";
import { formatAmount, formatMaxWithdrawHint, formatTime } from "@/lib/format";
import { parseHumanAmount, withdrawalAmountError } from "@/lib/amount";
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

// Parses a human decimal amount (e.g. "12.5") into 7-decimal base units.
// Returns null on invalid input; used only for the default-balance sync, where
// user-facing errors come from lib/amount's validators instead.
function parseAmount(human: string): bigint | null {
  try {
    return parseHumanAmount(human);
  } catch {
    return null;
  }
}

export function StreamActions({ stream, walletAddress, onComplete }: Props) {
  const [busy, setBusy] = useState<"withdraw" | "cancel" | null>(null);
  const [stage, setStage] = useState<TxStage | null>(null);
  const [timeoutHash, setTimeoutHash] = useState<string | null>(null);
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
    const message = withdrawalAmountError(amountInput, accrual.withdrawable);
    if (message !== null) {
      setAmountError(message);
      return null;
    }
    setAmountError(null);
    return parseAmount(amountInput);
  }

  // Live inline validation as the user types. Transient states — empty field
  // and a trailing decimal point mid-entry — stay error-free so typing is not
  // nagged; the submit path revalidates the final value either way.
  function handleAmountInputChange(value: string) {
    setAmountInput(value);
    setAmountError(
      !value.trim() || value.trim().endsWith(".")
        ? null
        : withdrawalAmountError(value, accrual.withdrawable),
    );
  }

  async function runWithdraw() {
    if (busy !== null) return;
    const amount = validateAmount();
    if (amount === null) return;

    setBusy("withdraw");
    setStage("preparing");
    setError(null);
    setLastTxHash(null);
    try {
      const streamId = BigInt(stream.id);
      // Use the full-balance shortcut when the user hasn't changed the amount,
      // avoiding an unnecessary i128 argument on the common path.
      const hash =
        amount === accrual.withdrawable
          ? await withdraw(caller, streamId, (s) => setStage(s))
          : await withdrawAmount(caller, streamId, amount, (s) => setStage(s));
      setLastTxHash(hash);
      setTimeoutHash(null);
      onComplete();
    } catch (err) {
      if (err instanceof TransactionTimeoutError) {
        setTimeoutHash(err.txHash);
        setError("Confirmation timed out. The transaction was submitted to the network.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to withdraw.");
      }
    } finally {
      setBusy(null);
      setStage(null);
    }
  }

  async function runCancel() {
    if (busy !== null) return;
    setBusy("cancel");
    setStage("preparing");
    setError(null);
    setLastTxHash(null);
    try {
      const hash = await cancel(caller, BigInt(stream.id), (s) => setStage(s));
      setLastTxHash(hash);
      setTimeoutHash(null);
      onComplete();
    } catch (err) {
      if (err instanceof TransactionTimeoutError) {
        setTimeoutHash(err.txHash);
        setError("Confirmation timed out. The transaction was submitted to the network.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to cancel.");
      }
    } finally {
      setBusy(null);
      setStage(null);
      setConfirmingCancel(false);
    }
  }

  async function handleRecoverTimeout() {
    if (!timeoutHash) return;
    setBusy("withdraw");
    setStage("confirming");
    setError(null);
    try {
      await confirmTransaction(timeoutHash, (s) => setStage(s));
      setLastTxHash(timeoutHash);
      setTimeoutHash(null);
      onComplete();
    } catch (err) {
      if (err instanceof TransactionTimeoutError) {
        setError("Confirmation timed out again. Check explorer or try again later.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to confirm transaction.");
      }
    } finally {
      setBusy(null);
      setStage(null);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      <TransactionProgress stage={stage} />
      {timeoutHash && (
        <div
          role="alert"
          className="my-2 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200"
        >
          <p className="font-semibold">Transaction confirmation timed out</p>
          <p className="mt-1 text-neutral-400">
            The transaction was submitted on-chain. You can re-check its status without re-submitting.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleRecoverTimeout()}
              disabled={busy !== null}
              className="rounded bg-amber-400 px-2.5 py-1 font-semibold text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
            >
              Re-check status
            </button>
            <a
              href={txExplorerUrl(timeoutHash, config.network)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 underline hover:text-amber-100"
            >
              View on Stellar Expert
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      )}
      {isRecipient && (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-400">
                Amount{" "}
                <span className="text-neutral-500">
                  (max {formatAmount(accrual.withdrawable.toString())})
                </span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => handleAmountInputChange(e.target.value)}
                onBlur={() => {
                  if (amountInput.trim()) setAmountError(withdrawalAmountError(amountInput, accrual.withdrawable));
                }}
                disabled={busy !== null || nothingToWithdraw}
                className={`w-44 rounded border bg-neutral-900 px-3 py-2 text-sm disabled:opacity-50 ${
                  amountError
                    ? "border-red-500 focus:border-red-400"
                    : "border-neutral-700 focus:border-neutral-500"
                }`}
                aria-label="Withdrawal amount"
                aria-invalid={!!amountError}
                aria-describedby={amountError ? "withdraw-amount-error" : nothingToWithdraw ? undefined : "withdraw-max-hint"}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setAmountInput(formatAmount(accrual.withdrawable.toString()));
                setAmountError(null);
              }}
              disabled={busy !== null || nothingToWithdraw}
              className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
              aria-label="Set maximum withdraw amount"
            >
              Max
            </button>
            <button
              onClick={() => void runWithdraw()}
              disabled={busy !== null || nothingToWithdraw || !!amountError}
              aria-describedby={nothingToWithdraw ? "withdraw-blocked-reason" : undefined}
              className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
            >
              {busy === "withdraw" ? "Withdrawing..." : "Withdraw"}
            </button>
          </div>
          {!nothingToWithdraw && (
            <p id="withdraw-max-hint" className="text-xs text-neutral-400">
              {formatMaxWithdrawHint(accrual.withdrawable.toString())}{" "}
              <button
                type="button"
                onClick={() => {
                  setAmountInput(formatAmount(accrual.withdrawable.toString()));
                  setAmountError(null);
                }}
                className="font-medium text-emerald-400 underline hover:text-emerald-300 ml-1"
              >
                Set max
              </button>
            </p>
          )}
          {amountError && (
            <p id="withdraw-amount-error" className="text-sm text-red-400">
              {amountError}
            </p>
          )}
          {nothingToWithdraw && (
            <p id="withdraw-blocked-reason" className="text-sm text-neutral-500">
              {blockedReason(stream)}
            </p>
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
