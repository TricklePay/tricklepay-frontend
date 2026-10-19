// Confirmation polling for submitted transactions. Extracted from the
// invocation flow so the wait-and-retry behaviour (and its failure-string
// parsing) can be tested without building or signing anything.

import { rpc, StrKey, xdr } from "@stellar/stellar-sdk";

import { CONFIRM_POLL_ATTEMPTS, CONFIRM_POLL_INTERVAL_MS } from "@/lib/contract-config";
import { parseContractError } from "@/lib/contract-errors";
import { TX_CONFIRM_TIMEOUT_MESSAGE } from "@/lib/contract-messages";
import { server } from "@/lib/contract-network";
import type { TxStage } from "@/types/contract";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Thrown when the confirmation polling loop exhausts its attempts without
 * seeing SUCCESS or FAILED. This does NOT mean the transaction failed — it
 * means the client gave up waiting. The transaction may still confirm later.
 *
 * `txHash` is preserved so the caller can resume polling via
 * `confirmTransaction(hash)` without re-submitting the transaction.
 */
export class TransactionTimeoutError extends Error {
  txHash: string;
  constructor(txHash: string, message = TX_CONFIRM_TIMEOUT_MESSAGE) {
    super(message);
    this.name = "TransactionTimeoutError";
    this.txHash = txHash;
  }
}

/**
 * Resumes the "confirming" stage for a transaction that was already submitted
 * but timed out (i.e. a TransactionTimeoutError was thrown). Polls the same
 * hash without re-submitting — safe to call multiple times.
 *
 * Use this to implement a "Check again" recovery action in the UI after a
 * timeout, rather than asking the user to retry the full flow.
 */
export async function confirmTransaction(
  hash: string,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  onStageChange?.("confirming");
  const srv = server();
  return confirm(srv, hash);
}

export async function confirm(srv: rpc.Server, hash: string): Promise<string> {
  // Soroban transactions are not confirmed synchronously upon submission. The
  // network must first include the transaction in a ledger, so the client must
  // poll `getTransaction` until the status changes from PENDING.
  for (let attempt = 0; attempt < CONFIRM_POLL_ATTEMPTS; attempt++) {
    const result = await srv.getTransaction(hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      // Diagnostic events (when available) contain the authoritative
      // "Error(Contract, #N)" token. Fall back to the result XDR string
      // representation, then to the generic message.
      const raw = extractFailureString(result);
      throw new Error(parseContractError(raw));
    }
    await sleep(CONFIRM_POLL_INTERVAL_MS);
  }
  throw new TransactionTimeoutError(hash);
}

/**
 * Builds a single string from a failed transaction response that is likely to
 * contain an "Error(Contract, #N)" token if the failure originated from the
 * contract. Diagnostic events are the most reliable source; the result XDR
 * base64 string is used as a fallback for pattern matching.
 */
function extractFailureString(result: rpc.Api.GetFailedTransactionResponse): string {
  if (result.diagnosticEventsXdr && result.diagnosticEventsXdr.length > 0) {
    // Prefer an error event that names its contract, so parseContractError can
    // tell a token's error from the stream contract's; host-emitted events
    // carry no contract id.
    let unattributed: string | null = null;
    for (const event of result.diagnosticEventsXdr) {
      const token = findContractErrorToken(event);
      if (!token) continue;
      if (token.startsWith("contract:")) return token;
      unattributed ??= token;
    }
    if (unattributed) return unattributed;
  }
  // Nothing actionable found; return an empty string so parseContractError
  // falls through to the generic message.
  return "";
}

/**
 * Inspects a single DiagnosticEvent for a contract error ScVal in its topics,
 * returning a synthetic "Error(Contract, #N)" string if one is found. When the
 * event names the contract that emitted it, the string is prefixed the way the
 * RPC's own event log is ("contract:C…, topics:[error, Error(Contract, #N)]").
 *
 * A Soroban host error event has the structure:
 *   topics: [Symbol("error"), ScVal(scvError, ScError(sceContract, code: N))]
 *   data:   string description
 */
function findContractErrorToken(event: xdr.DiagnosticEvent): string | null {
  try {
    const body = event.event().body().v0();
    for (const topic of body.topics()) {
      if (topic.switch().name !== "scvError") continue;
      const scError = topic.error();
      // ScError is an XDR union: `switch()` is the discriminant, and the
      // contract-error arm is named "sceContract".
      if (scError.switch().name !== "sceContract") continue;
      const code = scError.contractCode();
      const token = `Error(Contract, #${code})`;
      const contractId = event.event().contractId();
      if (!contractId) return token;
      return `contract:${StrKey.encodeContract(Buffer.from(contractId as unknown as Uint8Array))}, topics:[error, ${token}]`;
    }
  } catch {
    // XDR traversal failed — the event shape was unexpected, skip it.
  }
  return null;
}
