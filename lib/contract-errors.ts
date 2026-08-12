// Maps the numeric error codes emitted by the on-chain contract to plain-language
// messages a user can act on. Codes not in this table fall back to a generic
// message that still surfaces the raw code so users can report it.
//
// The source of truth is StreamError in the contract's error.rs. The codes are
// explicit discriminants there, not positions, so the gap at 2 is deliberate:
//
//    1  StreamNotFound
//    3  InvalidTimeRange
//    4  InvalidAmount
//    5  InvalidCliff
//    6  AlreadyCancelled
//    7  NothingToWithdraw
//    8  InsufficientBalance
//    9  StreamAlreadyCompleted
//   10  AmountTooLarge
//
// Code 2 was Unauthorized, removed from the contract as unreachable —
// require_auth aborts before the contract can return it. It is still mapped
// because contracts deployed before that change remain on-chain and can emit it.
export const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: "Stream not found.",
  2: "You are not authorized to perform this action.",
  3: "Invalid time range — the stream must start before it ends.",
  4: "Invalid amount — the total must be greater than zero.",
  5: "Invalid cliff — the cliff must fall between the start and end times.",
  6: "This stream has already been cancelled.",
  7: "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
  8: "That is more than you can withdraw right now.",
  9: "This stream has already completed and can no longer be cancelled.",
  10: "That amount is too large. The total must not exceed 9223372036854775807.",
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
