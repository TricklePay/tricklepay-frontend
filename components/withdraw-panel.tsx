import type { JSX } from "react";

import { formatMaxWithdrawHint, formatTokenAmount } from "@/lib/format";

/**
 * The recipient's withdrawal controls: amount field with a Max shortcut, the
 * Withdraw button, and the hint, error, or blocked-reason line beneath.
 * Purely presentational; state and validation come from useStreamActions.
 */
export function WithdrawPanel({
  withdrawable,
  token,
  amountInput,
  amountError,
  blockedReason,
  busy,
  withdrawing,
  onAmountChange,
  onAmountBlur,
  onSetMax,
  onWithdraw,
}: {
  withdrawable: bigint;
  token: string;
  amountInput: string;
  amountError: string | null;
  /** Why nothing can be withdrawn right now, or null when something can. */
  blockedReason: string | null;
  busy: boolean;
  withdrawing: boolean;
  onAmountChange: (value: string) => void;
  onAmountBlur: () => void;
  onSetMax: () => void;
  onWithdraw: () => void;
}): JSX.Element {
  const nothingToWithdraw = blockedReason !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">
            Amount{" "}
            <span className="text-neutral-500">
              (max {formatTokenAmount(withdrawable.toString(), token)})
            </span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => onAmountChange(e.target.value)}
            onBlur={onAmountBlur}
            disabled={busy || nothingToWithdraw}
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
          onClick={onSetMax}
          disabled={busy || nothingToWithdraw}
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
          aria-label="Set maximum withdraw amount"
        >
          Max
        </button>
        <button
          type="button"
          onClick={onWithdraw}
          disabled={busy || nothingToWithdraw || !!amountError}
          aria-describedby={nothingToWithdraw ? "withdraw-blocked-reason" : undefined}
          className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {withdrawing ? "Withdrawing..." : "Withdraw"}
        </button>
      </div>
      {!nothingToWithdraw && (
        <p id="withdraw-max-hint" className="text-xs text-neutral-400">
          {formatMaxWithdrawHint(withdrawable.toString(), token)}{" "}
          <button
            type="button"
            onClick={onSetMax}
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
          {blockedReason}
        </p>
      )}
    </div>
  );
}
