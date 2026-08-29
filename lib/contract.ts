// Builds, signs, submits, and confirms Soroban contract invocations for the
// stream write path (create, withdraw, withdraw_amount, cancel). Every call
// follows the same flow: fetch the account, build the transaction, simulate
// and assemble the resource footprint, then hand the prepared XDR to Freighter
// for signing. Signing happens in the wallet, never in the client — the
// private key never leaves Freighter. The signed transaction is then submitted
// over RPC and polled until it confirms on-chain, with each stage surfaced
// through onStageChange so the UI can show progress.

import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { getNetwork, signTransaction } from "@stellar/freighter-api";
import { config } from "@/lib/config";
import { parseContractError } from "@/lib/contract-errors";

export interface CreateStreamParams {
  sender: string;
  recipient: string;
  token: string;
  totalAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  cliffTime: bigint;
}

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

export type TxStage = "preparing" | "signing" | "submitting" | "confirming";

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
// returning the transaction hash once it succeeds on-chain. Each step surfaces
// a distinct error so the UI can tell the user what went wrong.
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

    onStageChange?.("preparing");
    const srv = server();
    const contract = new Contract(config.contractId);
    const account = await srv.getAccount(caller);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(buildOp(contract))
      .setTimeout(60)
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

    onStageChange?.("signing");
    const signed = await signTransaction(prepared.toXDR(), {
      networkPassphrase: config.networkPassphrase,
      address: caller,
    });
    if (signed.error) {
      throw new Error("Signing was rejected in the wallet.");
    }

    onStageChange?.("submitting");
    const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, config.networkPassphrase);
    const sent = await srv.sendTransaction(signedTx);
    if (sent.status === "ERROR") {
      throw new Error("The network rejected the transaction.");
    }

    onStageChange?.("confirming");
    return await confirm(srv, sent.hash);
  } finally {
    isInvocationActive = false;
  }
}

export class TransactionTimeoutError extends Error {
  txHash: string;
  constructor(txHash: string, message = "Timed out waiting for confirmation.") {
    super(message);
    this.name = "TransactionTimeoutError";
    this.txHash = txHash;
  }
}

/**
 * Re-checks an in-flight transaction confirmation status by hash.
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
  for (let attempt = 0; attempt < 30; attempt++) {
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
    await sleep(1000);
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
