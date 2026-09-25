"use client";

import { useEffect, useState } from "react";

import { useAccrual } from "@/hooks/use-accrual";
import { parseHumanAmount, withdrawalAmountError } from "@/lib/amount";
import { cancel, withdraw, withdrawAmount, confirmTransaction, TransactionTimeoutError } from "@/lib/contract";
import { formatAmount } from "@/lib/format";
import type { TxStage } from "@/types/contract";
import type { StreamView } from "@/types/stream";

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

/** Everything StreamActions needs from useStreamActions. */
export interface StreamActionsState {
  withdrawable: bigint;
  nothingToWithdraw: boolean;
  busy: "withdraw" | "cancel" | null;
  stage: TxStage | null;
  timeoutHash: string | null;
  error: string | null;
  lastTxHash: string | null;
  amountInput: string;
  amountError: string | null;
  confirmingCancel: boolean;
  changeAmount: (value: string) => void;
  blurAmount: () => void;
  setMaxAmount: () => void;
  runWithdraw: () => Promise<void>;
  runCancel: () => Promise<void>;
  recoverTimeout: () => Promise<void>;
  openCancelConfirm: () => void;
  closeCancelConfirm: () => void;
}

/**
 * Owns StreamActions' data handling: the live withdrawable balance, the
 * withdrawal amount field and its validation, the cancel confirmation step,
 * and the withdraw / cancel / timeout-recovery transactions.
 */
export function useStreamActions(
  stream: StreamView,
  walletAddress: string | null,
  onComplete: () => void,
): StreamActionsState {
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

  // Status alone is not enough: between start and cliff a stream is already
  // "streaming" while nothing has vested, and the contract rejects that
  // withdrawal with NothingToWithdraw. Gate on the amount itself so the button
  // never sends a transaction that is certain to revert.
  const nothingToWithdraw = accrual.withdrawable === 0n;

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
  function changeAmount(value: string) {
    setAmountInput(value);
    setAmountError(
      !value.trim() || value.trim().endsWith(".")
        ? null
        : withdrawalAmountError(value, accrual.withdrawable),
    );
  }

  function blurAmount() {
    if (amountInput.trim()) setAmountError(withdrawalAmountError(amountInput, accrual.withdrawable));
  }

  function setMaxAmount() {
    setAmountInput(formatAmount(accrual.withdrawable.toString()));
    setAmountError(null);
  }

  async function runWithdraw() {
    if (busy !== null || !walletAddress) return;
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
          ? await withdraw(walletAddress, streamId, (s) => setStage(s))
          : await withdrawAmount(walletAddress, streamId, amount, (s) => setStage(s));
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
    if (busy !== null || !walletAddress) return;
    setBusy("cancel");
    setStage("preparing");
    setError(null);
    setLastTxHash(null);
    try {
      const hash = await cancel(walletAddress, BigInt(stream.id), (s) => setStage(s));
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

  async function recoverTimeout() {
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

  return {
    withdrawable: accrual.withdrawable,
    nothingToWithdraw,
    busy,
    stage,
    timeoutHash,
    error,
    lastTxHash,
    amountInput,
    amountError,
    confirmingCancel,
    changeAmount,
    blurAmount,
    setMaxAmount,
    runWithdraw,
    runCancel,
    recoverTimeout,
    openCancelConfirm: () => setConfirmingCancel(true),
    closeCancelConfirm: () => setConfirmingCancel(false),
  };
}
