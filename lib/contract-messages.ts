// User-facing copy for the transaction stage indicator (see
// components/transaction-progress.tsx) and for every failure the invocation
// flow can raise. Kept apart from the lib/contract-* logic modules so the
// submission flow's logic and its presentation strings can be reviewed
// independently — the logic modules only ever report a stage id
// ("preparing" | "signing" | "submitting" | "confirming") or throw one of
// these strings, never define the wording inline.

import type { TxStage, TxStageInfo } from "@/types/contract";

export const TX_STAGES: TxStageInfo[] = [
  { id: "preparing", label: "Prepare", detail: "Simulate transaction" },
  { id: "signing", label: "Sign", detail: "Wallet signature" },
  { id: "submitting", label: "Submit", detail: "Broadcast to network" },
  { id: "confirming", label: "Confirm", detail: "On-chain confirmation" },
];

export const TX_STAGE_LABELS: Record<TxStage, string> = {
  preparing: "Preparing transaction...",
  signing: "Awaiting wallet signature...",
  submitting: "Submitting to network...",
  confirming: "Confirming on network...",
};

// Shown when a second transaction starts while one is already in flight.
// The concurrency guard serialises invocations, so this is a client-side
// rejection before any network round-trip.
export const TX_ALREADY_IN_PROGRESS_MESSAGE =
  "A transaction is already in progress. Please wait for it to complete.";

// Shown when Freighter's active network does not match the app's configured
// network. Failing fast here avoids a signing prompt for a transaction the
// RPC would reject anyway, with an actionable next step.
export function wrongNetworkMessage(walletNetwork: string, expectedNetwork: string): string {
  return `Wrong network: wallet is on ${walletNetwork}, app expects ${expectedNetwork}. Switch networks in Freighter.`;
}

// Shown when Freighter reports signed.error after the signing prompt.
// Covers explicit rejection and expired XDR (the user took longer than the
// TX_TIMEOUT_SECONDS window to approve).
export const TX_SIGNING_REJECTED_MESSAGE = "Signing was rejected in the wallet.";

// Shown when the RPC rejects the broadcast outright (expired XDR, bad sequence,
// fee too low). The transaction never entered the pending pool.
export const TX_NETWORK_REJECTED_MESSAGE = "The network rejected the transaction.";

// Shown when the RPC repeatedly returns TRY_AGAIN_LATER across all submission
// retries because it is temporarily overloaded.
export const TX_RPC_BUSY_MESSAGE =
  "The network RPC is busy. Please try again in a moment.";

// Default message for TransactionTimeoutError: polling gave up waiting, not
// proof the transaction failed — it may still confirm later, hence the
// recoverable confirmTransaction() path.
export const TX_CONFIRM_TIMEOUT_MESSAGE = "Timed out waiting for confirmation.";

// Shown after a first timeout when the transaction was already submitted:
// the funds may move on-chain, so the UI offers a re-check, not a retry.
export const TX_CONFIRMATION_TIMED_OUT_SUBMITTED_MESSAGE =
  "Confirmation timed out. The transaction was submitted to the network.";

// Shown when a timeout-recovery re-poll also exhausts its budget.
export const TX_CONFIRMATION_TIMED_OUT_AGAIN_MESSAGE =
  "Confirmation timed out again. Check explorer or try again later.";

// Fallbacks when a transaction fails outside the mapped contract-error path.
// The raw error message is preferred when available; these cover unexpected
// throws so the UI never shows an empty error.
export const TX_FAILED_WITHDRAW_MESSAGE = "Failed to withdraw.";
export const TX_FAILED_CANCEL_MESSAGE = "Failed to cancel.";
export const TX_FAILED_CONFIRM_MESSAGE = "Failed to confirm transaction.";
export const TX_FAILED_CREATE_MESSAGE = "Failed to create stream.";

// Shown when the RPC reports that the account submitting the transaction does
// not exist on the network (HTTP 404 from getAccount). The account must be
// funded before any transaction can be built for it.
export const ACCOUNT_NOT_FOUND_MESSAGE =
  "This account has not been funded yet. Fund it before signing transactions.";

// Testnet-only friendbot URL; deeplinks to the account so the user only needs
// one click to request the initial XLM.
export function friendbotUrl(address: string): string {
  return `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`;
}

/**
 * Returns true when an error thrown by `rpc.Server.getAccount` indicates the
 * account does not exist on-chain (i.e. it has never been funded).
 *
 * The Stellar SDK throws a `BadResponseError` with `response.status === 404`
 * when the horizon / RPC returns "account not found". We also check the
 * message as a belt-and-suspenders guard for any SDK version that serialises
 * the status differently.
 */
export function isAccountNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // The SDK error message for a missing account contains "not found" and
  // typically "account".  The HTTP status path covers future SDK versions that
  // may format the message differently.
  return (
    msg.includes("account") && msg.includes("not found") ||
    // BadResponseError exposes `response` on the instance; check status 404.
    ("response" in err &&
      typeof (err as { response?: { status?: unknown } }).response === "object" &&
      (err as { response: { status?: unknown } }).response?.status === 404)
  );
}
