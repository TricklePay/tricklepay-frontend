// Reads a Stellar token balance for the create-stream review step, so the
// sender sees "You hold X, this stream needs Y" before the wallet simulation
// fails with an opaque token error.
//
// This is a read-only Soroban simulation: no sequence number is consumed and
// nothing is signed or submitted, so it is safe to run while the user reviews
// the form.

import { config } from "@/lib/config";
import { TRANSACTION_BASE_FEE, TX_TIMEOUT_SECONDS } from "@/lib/contract-config";

// simulateTransaction only needs the operation and the network passphrase, so
// the sequence number is never used — a placeholder keeps the read unsigned.
const READ_ONLY_SEQUENCE = "0";

/**
 * Reads `balance(holder)` from a token contract via a read-only simulation.
 *
 * @returns The balance in the token's base units (7-decimal standard), as a
 *   bigint.
 * @throws When the read cannot be completed — the RPC is unreachable, or the
 *   contract does not implement `balance`. Callers must treat this as
 *   best-effort and never block the flow on it.
 */
export async function readTokenBalance(tokenContractId: string, holder: string): Promise<bigint> {
  // Loaded on demand: the SDK is only needed once a balance is actually read.
  const [{ Account, Address, Contract, rpc, scValToNative, TransactionBuilder }, { server }] =
    await Promise.all([import("@stellar/stellar-sdk"), import("@/lib/contract-network")]);
  const contract = new Contract(tokenContractId);
  const tx = new TransactionBuilder(new Account(holder, READ_ONLY_SEQUENCE), {
    fee: TRANSACTION_BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call("balance", new Address(holder).toScVal()))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  const simulation = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }
  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new Error("Balance read did not complete.");
  }
  if (!simulation.result) {
    throw new Error("Balance read did not return a value.");
  }

  return BigInt(scValToNative(simulation.result.retval));
}
