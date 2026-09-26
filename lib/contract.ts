// Builds, signs, submits, and confirms Soroban contract invocations for the
// stream write path (create, withdraw, withdraw_amount, cancel). Every call
// follows the same flow: fetch the account, build the transaction, simulate
// and assemble the resource footprint, then hand the prepared XDR to Freighter
// for signing. Signing happens in the wallet, never in the client — the
// private key never leaves Freighter. The signed transaction is then submitted
// over RPC and polled until it confirms on-chain, with each stage surfaced
// through onStageChange so the UI can show progress.
//
// ─── TRANSACTION STAGES ──────────────────────────────────────────────────────
//
// Every public entry point (createStream, withdraw, withdrawAmount, cancel)
// funnels through the private invoke() function, which moves through four
// named stages. The current stage is broadcast via the optional onStageChange
// callback so components can update progress UI in real time.
//
//  Stage         UI label                  What happens
//  ──────────── ─────────────────────────  ────────────────────────────────────
//  "preparing"  "Preparing transaction…"   Fetches the caller's on-chain
//                                          account (sequence number), builds
//                                          the transaction, runs a Soroban
//                                          simulation to calculate the resource
//                                          footprint (fee, instructions, ledger
//                                          entries), and assembles the final XDR
//                                          ready for signing.
//
//  "signing"    "Awaiting wallet           Passes the assembled XDR to
//               signature…"               Freighter. The user sees a native
//                                          wallet approval dialog. The private
//                                          key never leaves the extension.
//
//  "submitting" "Submitting to network…"  Broadcasts the signed transaction
//                                          to the Soroban RPC endpoint
//                                          (config.rpcUrl). The RPC performs
//                                          basic structural validation and
//                                          accepts the transaction into its
//                                          pending pool.
//
//  "confirming" "Confirming on network…"  Polls getTransaction(hash) once per
//                                          second for up to 30 seconds until
//                                          the network includes the transaction
//                                          in a ledger and marks it SUCCESS or
//                                          FAILED.
//
// ─── WHERE FAILURES OCCUR ────────────────────────────────────────────────────
//
//  Before "preparing"
//    • isInvocationActive is true  → "A transaction is already in progress."
//    • Freighter network mismatch  → "Wrong network: wallet is on X, app
//                                     expects Y. Switch networks in Freighter."
//      (Only checked when Freighter responds without an error; a Freighter
//      failure here is silently skipped rather than blocking the call.)
//
//  During "preparing"
//    • srv.getAccount() fails      → Raw SDK error (address unfunded, RPC
//                                     unreachable). Not translated — surfaces
//                                     as-is so the operator can diagnose it.
//    • srv.prepareTransaction()    → Simulation reverted. The SDK embeds an
//      throws                        "Error(Contract, #N)" token in the message;
//                                     parseContractError() maps it to a
//                                     user-facing string (see lib/contract-errors.ts).
//                                     Common at this stage: invalid parameters
//                                     (codes 3–5, 10), already-cancelled (6),
//                                     already-completed (9).
//
//  During "signing"
//    • signed.error is truthy      → "Signing was rejected in the wallet."
//                                     Covers explicit rejection AND cases where
//                                     the built XDR has already expired (the
//                                     TX_TIMEOUT_SECONDS window covers simulation
//                                     + the user's approval time — if the user
//                                     takes longer than 60 s, the transaction
//                                     will also fail at submission).
//
//  During "submitting"
//    • sent.status === "ERROR"     → "The network rejected the transaction."
//                                     Covers expired XDR, duplicate submission,
//                                     fee too low, and other RPC-level rejections.
//
//  During "confirming"
//    • result.status === FAILED    → parseContractError() on diagnosticEventsXdr
//                                     (authoritative) or the result XDR (fallback).
//                                     Common at this stage: nothing to withdraw (7),
//                                     insufficient balance (8).
//    • 30 polls exhausted          → TransactionTimeoutError (a named Error
//                                     subclass carrying txHash). The UI can
//                                     offer a "check again" recovery path using
//                                     the exported confirmTransaction() helper,
//                                     which resumes polling from the same hash
//                                     without re-submitting.
//
// ─── CONCURRENCY GUARD ───────────────────────────────────────────────────────
//
// A module-level isInvocationActive flag serialises all invocations: only one
// transaction may be in flight at a time. The flag is set in invoke() before
// the first await and cleared in a finally block, so any thrown error releases
// it. isTransactionPending() exposes the flag for UI disabling.

import { getNetwork, signTransaction } from "@stellar/freighter-api";
import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

import { config } from "@/lib/config";
import { parseContractError } from "@/lib/contract-errors";
import type { CreateStreamParams, TxStage } from "@/types/contract";

// Seconds a built transaction stays valid. Covers simulation, the wallet's
// signing prompt and submission; after that the network rejects it outright.
const TX_TIMEOUT_SECONDS = 60;

// Confirmation polls getTransaction once a second for up to 30 seconds before
// giving up with a TransactionTimeoutError the user can recover from.
const CONFIRM_POLL_INTERVAL_MS = 1_000;
const CONFIRM_POLL_ATTEMPTS = 30;

function server(): rpc.Server {
  return new rpc.Server(config.rpcUrl, { allowHttp: config.rpcUrl.startsWith("http://") });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Maps Freighter's network label to the app's lowercase names, mirroring
// the normalisation in wallet-provider.tsx so the comparison is consistent.
function normalizeNetwork(network: string): string {
  const lower = network.toLowerCase();
  if (lower.includes("test")) return "testnet";
  if (lower.includes("public")) return "mainnet";
  return lower;
}

/**
 * The four named stages a transaction moves through, in order.
 * Passed to the `onStageChange` callback so components can update progress UI.
 * See the module-level comment for what each stage does and where it can fail.
 */
export type TxStage = "preparing" | "signing" | "submitting" | "confirming";

/** Metadata for rendering a stage step in the UI (label, supporting detail). */
export interface TxStageInfo {
  id: TxStage;
  label: string;
  detail: string;
}

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

let isInvocationActive = false;

/**
 * Returns whether a contract transaction invocation is currently in progress.
 */
export function isTransactionPending(): boolean {
  return isInvocationActive;
}

// Builds, signs (via Freighter), submits, and confirms a contract invocation,
// returning the transaction hash once it succeeds on-chain.
//
// onStageChange is called at the start of each stage so the UI can show
// progress. It is not called for the pre-stage guard checks (concurrency lock
// and network mismatch), because those fail before any meaningful work begins.
async function invoke(
  caller: string,
  buildOp: (contract: Contract) => xdr.Operation,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  if (isInvocationActive) {
    throw new Error("A transaction is already in progress. Please wait for it to complete.");
  }

  isInvocationActive = true;
  try {
    // Guard: reject immediately if Freighter's active network does not match
    // the network the app is configured for. This is a hard stop — a transaction
    // built against the wrong network passphrase would be rejected by the RPC
    // anyway, but checking here gives a clear, actionable error before any
    // network round-trip or signing prompt occurs.
    const netResult = await getNetwork();
    if (!netResult.error) {
      const walletNetwork = normalizeNetwork(netResult.network);
      if (walletNetwork !== config.network) {
        throw new Error(
          `Wrong network: wallet is on ${walletNetwork}, app expects ${config.network}. Switch networks in Freighter.`,
        );
      }
    }

    // ── STAGE: preparing ────────────────────────────────────────────────────
    // Fetch the caller's account (for the current sequence number), build the
    // transaction, then simulate it via prepareTransaction to calculate the
    // Soroban resource footprint (fee, instructions, ledger entry accesses).
    // The simulation also runs the contract logic — if the call would revert
    // on-chain it fails here, before any signing prompt appears.
    onStageChange?.("preparing");
    const srv = server();
    const contract = new Contract(config.contractId);
    const account = await srv.getAccount(caller);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(buildOp(contract))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    // Simulate and assemble the Soroban resource footprint before signing.
    // prepareTransaction throws if simulation reverts; its message contains the
    // "Error(Contract, #N)" token so we translate it here.
    let prepared: Awaited<ReturnType<typeof srv.prepareTransaction>>;
    try {
      prepared = await srv.prepareTransaction(tx);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      throw new Error(parseContractError(raw));
    }

    // ── STAGE: signing ───────────────────────────────────────────────────────
    // Hand the prepared XDR to Freighter. The user sees a native approval
    // dialog. signTransaction resolves once the user approves or rejects;
    // signed.error is set on rejection (or Freighter internal failure).
    onStageChange?.("signing");
    const signed = await signTransaction(prepared.toXDR(), {
      networkPassphrase: config.networkPassphrase,
      address: caller,
    });
    if (signed.error) {
      throw new Error("Signing was rejected in the wallet.");
    }

    // ── STAGE: submitting ────────────────────────────────────────────────────
    // Broadcast the signed transaction to the RPC. sendTransaction performs
    // structural validation (fee, sequence number, XDR well-formedness) and
    // adds it to the pending pool. It does NOT wait for ledger inclusion.
    // status "ERROR" means the RPC rejected it outright before inclusion.
    onStageChange?.("submitting");
    const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, config.networkPassphrase);
    const sent = await srv.sendTransaction(signedTx);
    if (sent.status === "ERROR") {
      throw new Error("The network rejected the transaction.");
    }

    // ── STAGE: confirming ────────────────────────────────────────────────────
    // Soroban transactions are not confirmed synchronously. Poll until the
    // network includes the transaction in a ledger. See confirm() below.
    onStageChange?.("confirming");
    return await confirm(srv, sent.hash);
  } finally {
    isInvocationActive = false;
  }
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
  constructor(txHash: string, message = "Timed out waiting for confirmation.") {
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

async function confirm(srv: rpc.Server, hash: string): Promise<string> {
  // Soroban transactions are not confirmed synchronously upon submission. The
  // network must first include the transaction in a ledger, so the client must
  // poll `getTransaction` until the status changes from PENDING.
  //
  // This polling loop checks once per second for up to 30 seconds. If the
  // transaction is still not confirmed, it throws a TransactionTimeoutError.
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
 *
 * The Soroban host emits a diagnostic event with topics [error, ScError] when a
 * contract traps. The ScError is an xdr.ScVal of type scvError whose error field
 * has type scErrorTypeContract and a contractCode equal to the enum value. When
 * serialised back to JSON or base64 and fed through our regex the contractCode
 * digit will not appear as "Error(Contract, #N)" — instead we must reconstruct
 * that string manually from the parsed XDR fields.
 */
function extractFailureString(result: rpc.Api.GetFailedTransactionResponse): string {
  if (result.diagnosticEventsXdr && result.diagnosticEventsXdr.length > 0) {
    for (const event of result.diagnosticEventsXdr) {
      const token = findContractErrorToken(event);
      if (token) return token;
    }
  }
  // Nothing actionable found; return an empty string so parseContractError
  // falls through to the generic message.
  return "";
}

/**
 * Inspects a single DiagnosticEvent for a contract error ScVal in its topics,
 * returning a synthetic "Error(Contract, #N)" string if one is found.
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
      return `Error(Contract, #${code})`;
    }
  } catch {
    // XDR traversal failed — the event shape was unexpected, skip it.
  }
  return null;
}

export async function createStream(
  params: CreateStreamParams,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  return invoke(
    params.sender,
    (contract) =>
      contract.call(
        "create_stream",
        new Address(params.sender).toScVal(),
        new Address(params.recipient).toScVal(),
        new Address(params.token).toScVal(),
        nativeToScVal(params.totalAmount, { type: "i128" }),
        nativeToScVal(params.startTime, { type: "u64" }),
        nativeToScVal(params.endTime, { type: "u64" }),
        nativeToScVal(params.cliffTime, { type: "u64" }),
      ),
    onStageChange,
  );
}

export async function withdraw(
  caller: string,
  streamId: bigint,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  return invoke(
    caller,
    (contract) => contract.call("withdraw", nativeToScVal(streamId, { type: "u64" })),
    onStageChange,
  );
}

/**
 * Withdraws a specific amount from a stream instead of the full vested balance.
 * Maps to the contract's `withdraw_amount(id, amount)` entry point.
 * `amount` is in base units (7 decimal places, the Stellar stroop standard).
 */
export async function withdrawAmount(
  caller: string,
  streamId: bigint,
  amount: bigint,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  return invoke(
    caller,
    (contract) =>
      contract.call(
        "withdraw_amount",
        nativeToScVal(streamId, { type: "u64" }),
        nativeToScVal(amount, { type: "i128" }),
      ),
    onStageChange,
  );
}

export async function cancel(
  caller: string,
  streamId: bigint,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  return invoke(
    caller,
    (contract) => contract.call("cancel", nativeToScVal(streamId, { type: "u64" })),
    onStageChange,
  );
}
