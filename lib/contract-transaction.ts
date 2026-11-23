// Transaction building, signing, and submission steps. Extracted from the
// invocation flow so each RPC boundary can be tested and tuned on its own;
// orchestration lives in lib/contract-invoke.ts.

import { signTransaction } from "@stellar/freighter-api";
import { Contract, rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import type { xdr } from "@stellar/stellar-sdk";

import { config } from "@/lib/config";
import {
  SUBMIT_MAX_ATTEMPTS,
  SUBMIT_RETRY_BASE_DELAY_MS,
  TRANSACTION_BASE_FEE,
  TX_TIMEOUT_SECONDS,
} from "@/lib/contract-config";
import { parseContractError } from "@/lib/contract-errors";
import {
  ACCOUNT_NOT_FOUND_MESSAGE,
  isAccountNotFoundError,
  parseRpcTransactionError,
  parseSigningError,
  TX_NETWORK_REJECTED_MESSAGE,
  TX_RPC_BUSY_MESSAGE,
} from "@/lib/contract-messages";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the caller's account (for the current sequence number), builds the
 * transaction, then simulates it via prepareTransaction to calculate the
 * Soroban resource footprint (fee, instructions, ledger entry accesses).
 * The simulation also runs the contract logic — if the call would revert
 * on-chain it fails here, before any signing prompt appears.
 */
export async function buildAndPrepareTransaction(
  srv: rpc.Server,
  caller: string,
  buildOp: (contract: Contract) => xdr.Operation,
): Promise<Awaited<ReturnType<rpc.Server["prepareTransaction"]>>> {
  const contract = new Contract(config.contractId);
  // getAccount throws when the account does not exist on-chain (never funded).
  // Catch that specific case before any signing prompt so the user gets an
  // actionable message instead of a raw SDK error.
  let account;
  try {
    account = await srv.getAccount(caller);
  } catch (err) {
    if (isAccountNotFoundError(err)) {
      throw new Error(ACCOUNT_NOT_FOUND_MESSAGE);
    }
    throw err;
  }

  const tx = new TransactionBuilder(account, {
    fee: TRANSACTION_BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(buildOp(contract))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  // prepareTransaction throws if simulation reverts; its message contains the
  // "Error(Contract, #N)" token so we translate it here.
  try {
    return await srv.prepareTransaction(tx);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(parseContractError(raw));
  }
}

/**
 * Hands the prepared XDR to Freighter. The user sees a native approval
 * dialog. signTransaction resolves once the user approves or rejects;
 * signed.error is set on rejection (or Freighter internal failure).
 */
export async function signPreparedTransaction(
  preparedXdr: string,
  caller: string,
): Promise<string> {
  const signed = await signTransaction(preparedXdr, {
    networkPassphrase: config.networkPassphrase,
    address: caller,
  });
  if (signed.error) {
    throw new Error(parseSigningError(signed.error));
  }
  return signed.signedTxXdr;
}

/**
 * Broadcasts the signed transaction to the RPC. sendTransaction performs
 * structural validation (fee, sequence number, XDR well-formedness) and
 * adds it to the pending pool. It does NOT wait for ledger inclusion.
 *
 * - "PENDING" / "DUPLICATE": transaction is in the pending pool; returns the hash
 *   for the confirming stage.
 * - "TRY_AGAIN_LATER": RPC is busy; retries with exponential backoff before
 *   failing with TX_RPC_BUSY_MESSAGE.
 * - "ERROR" (or any other status): rejected outright; throws TX_NETWORK_REJECTED_MESSAGE.
 */
export async function submitSignedTransaction(srv: rpc.Server, signedTxXdr: string): Promise<string> {
  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, config.networkPassphrase);

  for (let attempt = 0; attempt < SUBMIT_MAX_ATTEMPTS; attempt++) {
    const sent = await srv.sendTransaction(signedTx);
    if (sent.status === "PENDING" || sent.status === "DUPLICATE") {
      return sent.hash;
    }
    if (sent.status === "TRY_AGAIN_LATER") {
      if (attempt < SUBMIT_MAX_ATTEMPTS - 1) {
        await sleep(SUBMIT_RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      throw new Error(TX_RPC_BUSY_MESSAGE);
    }
    if (sent.status === "ERROR") {
      throw new Error(parseRpcTransactionError(sent));
    }
    throw new Error(TX_NETWORK_REJECTED_MESSAGE);
  }

  throw new Error(TX_RPC_BUSY_MESSAGE);
}
