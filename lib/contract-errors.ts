// Maps the numeric error codes emitted by the on-chain contract (error.rs) to
// plain-language messages a user can act on. Codes not in this table fall back
// to a generic message that still surfaces the raw code so users can report it.
//
// error.rs enum (1-indexed):
//   1  AlreadyCancelled
//   2  AlreadyCompleted
//   3  NotRecipient
//   4  NotSender
//   5  StreamNotFound
//   6  InvalidInput
//   7  NothingToWithdraw
//   8  InsufficientBalance
export const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: "This stream has already been cancelled.",
  2: "This stream has already completed.",
  3: "Only the recipient can perform this action.",
  4: "Only the sender can perform this action.",
  5: "Stream not found.",
  6: "Invalid input — check that all values are within the allowed range.",
  7: "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
  8: "The sender's account has insufficient balance to fund this stream.",
};

export const GENERIC_FAILURE = "The transaction failed on-chain.";

/**
 * The Soroban host formats contract errors as "Error(Contract, #N)" in
 * diagnostic/simulation output and in thrown Error messages. This regex
 * captures the numeric code.
 *
 * Source: stellar-sdk `contractErrorPattern` in src/contract/utils.ts
 */
const CONTRACT_ERROR_RE = /Error\(Contract,\s*#(\d+)\)/;

/**
 * Extracts a contract error code from any string that may contain a Soroban
 * "Error(Contract, #N)" token, then maps it to a user-facing message.
 *
 * Returns the generic failure message when no code can be found, or when the
 * code is not in the known table (appending the raw code for debuggability).
 *
 * @example
 * parseContractError("invocation trapped: Error(Contract, #7)")
 * // → "Nothing to withdraw yet — no tokens have vested since your last withdrawal."
 *
 * @example
 * parseContractError("Error(Contract, #99)")
 * // → "The transaction failed on-chain. (error code 99)"
 *
 * @example
 * parseContractError("some unrelated error")
 * // → "The transaction failed on-chain."
 */
export function parseContractError(raw: string): string {
  const match = CONTRACT_ERROR_RE.exec(raw);
  if (!match) return GENERIC_FAILURE;
  const code = parseInt(match[1], 10);
  return CONTRACT_ERROR_MESSAGES[code] ?? `${GENERIC_FAILURE} (error code ${code})`;
}
