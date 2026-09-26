"use client";

import type { JSX } from "react";

import { CancelStreamControl } from "@/components/cancel-stream-control";
import { TimeoutRecoveryAlert } from "@/components/timeout-recovery-alert";
import { TransactionProgress } from "@/components/transaction-progress";
import { WithdrawPanel } from "@/components/withdraw-panel";
import { useStreamActions } from "@/hooks/use-stream-actions";
import { config } from "@/lib/config";
import { txExplorerUrl } from "@/lib/explorer";
import { blockedReason, canSenderCancel } from "@/lib/stream-actions";
import type { StreamView } from "@/types/stream";

export { canSenderCancel };

interface Props {
  stream: StreamView;
  walletAddress: string | null;
  onComplete: () => void;
}

/**
 * Withdraw (recipient) and cancel (sender) actions for a stream, plus the
 * shared transaction feedback. Data handling lives in useStreamActions; this
 * component decides which controls the connected wallet gets.
 */
export function StreamActions({ stream, walletAddress, onComplete }: Props): JSX.Element | null {
  const actions = useStreamActions(stream, walletAddress, onComplete);

  if (!walletAddress) return null;

  const isRecipient = walletAddress === stream.recipient;
  const canCancel = canSenderCancel(stream, walletAddress);

  if (!isRecipient && !canCancel) return null;

  const busy = actions.busy !== null;

  return (
    <div className="mt-8 flex flex-col gap-3">
      <TransactionProgress stage={actions.stage} />
      {actions.timeoutHash && (
        <TimeoutRecoveryAlert
          hash={actions.timeoutHash}
          disabled={busy}
          onRecheck={() => void actions.recoverTimeout()}
        />
      )}
      {isRecipient && (
        <WithdrawPanel
          withdrawable={actions.withdrawable}
          token={stream.token}
          amountInput={actions.amountInput}
          amountError={actions.amountError}
          blockedReason={actions.nothingToWithdraw ? blockedReason(stream) : null}
          busy={busy}
          withdrawing={actions.busy === "withdraw"}
          onAmountChange={actions.changeAmount}
          onAmountBlur={actions.blurAmount}
          onSetMax={actions.setMaxAmount}
          onWithdraw={() => void actions.runWithdraw()}
        />
      )}

      {canCancel && (
        <CancelStreamControl
          confirming={actions.confirmingCancel}
          busy={busy}
          cancelling={actions.busy === "cancel"}
          onRequestCancel={actions.openCancelConfirm}
          onConfirm={() => void actions.runCancel()}
          onDismiss={actions.closeCancelConfirm}
        />
      )}

      {actions.error && <p className="text-sm text-red-400">{actions.error}</p>}

      {actions.lastTxHash && (
        <p className="text-sm text-neutral-500">
          Confirmed.{" "}
          <a
            href={txExplorerUrl(actions.lastTxHash, config.network)}
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
