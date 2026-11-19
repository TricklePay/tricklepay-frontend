// Reads a Stellar token balance for the create-stream review step, so the
// sender sees "You hold X, this stream needs Y" before the wallet simulation
// fails with an opaque token error.
//
// This is a read-only Soroban simulation: no sequence number is consumed and
// nothing is signed or submitted, so it is safe to run while the user reviews
// the form.

import { simulateRead } from "@/lib/contract-read";

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
  const { Address } = await import("@stellar/stellar-sdk");
  const nativeBalance = await simulateRead<bigint | number | string>(
    tokenContractId,
    "balance",
    [new Address(holder).toScVal()],
  );
  return BigInt(nativeBalance);
}
