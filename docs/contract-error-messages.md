# Maintaining contract error messages

The frontend translates Soroban contract errors into messages users can act on. When the on-chain contract adds or changes an error, update the client mapping and tests **in the same contribution**; do not guess numeric codes from their enum order.

## Sources of truth

- **Contract codes:** [`StreamError` in `tricklepay-contracts/contracts/stream/src/error.rs`](https://github.com/TricklePay/tricklepay-contracts/blob/main/contracts/stream/src/error.rs). Each code is an explicit `#[repr(u32)]` discriminant. A retired code (currently `2`) must not be reused.
- **Frontend mapping:** [`lib/contract-errors.ts`](../lib/contract-errors.ts), specifically `CONTRACT_ERROR_MESSAGES` and `parseContractError()`.
- **Coverage tests:** [`lib/contract-errors.test.ts`](../lib/contract-errors.test.ts), especially `CONTRACT_ERROR_CODES`, `NEXT_UNUSED_CODE`, and the token-error attribution tests.

## Add or change a message

1. Read the current `StreamError` variant and its **explicit integer value** in the contract's `error.rs`; confirm what operation raises it and whether the frontend already handles it. Do not use variant order as an error code.
2. Add or update that integer key in `CONTRACT_ERROR_MESSAGES` in `lib/contract-errors.ts`. Describe the user-visible condition in plain English and, where possible, a **specific corrective action**. Use sentence case and terminal punctuation; avoid raw `Error(Contract, #N)` text in the primary message.
3. When adding a new on-chain error, add its integer to the independently maintained `CONTRACT_ERROR_CODES` list in `lib/contract-errors.test.ts` and revise `NEXT_UNUSED_CODE` to the next actually unused discriminant. Verify that every active code is covered and that different errors have distinct messages. Keep the retired `2` mapping for compatibility with previously deployed contracts.
4. Add a focused `parseContractError()` test covering the new or changed wording and its fallback behavior where applicable. Include a realistic host diagnostic such as `HostError: Error(Contract, #N)`; if a token-contract error can collide with the number, test attribution using the failing **contract ID** in the diagnostic event.
5. Run the checks and review the diff to ensure you did not unintentionally change error parsing or transaction state semantics:

   ```sh
   npm run lint
   npm run typecheck
   npm test -- lib/contract-errors.test.ts
   npm test
   npm run build
   ```

For documentation-only edits, these checks are recommended but do not replace checking that the paths, links, and procedure match the current repository.

## Important distinctions

- **Stream vs token contract:** Soroban error numbers are **contract-scoped**. For example, stream code `10` is `AmountTooLarge`, while Stellar Asset Contract code `10` may mean an insufficient token balance. `parseContractError()` checks the failing contract ID when diagnostic events contain it. Do not map an attributed token failure using the stream error table; keep `tokenFailureMessage()` as the appropriate fallback.
- **Authorization:** The contract uses `require_auth()` for authorization; failures from it are host authorization errors, **not** a new `StreamError` discriminant. The retired code `2` mapping remains for older deployments only.
- **Unknown codes:** Preserve the generic failure message and numeric code from `parseContractError()` so an unmapped future error is reportable. Do not assert that an operation was rejected if transaction confirmation simply timed out; timeout text belongs in `lib/contract-messages.ts`.
- **Compatibility:** Never renumber or reuse contract discriminants to simplify the client table. Update tests against the **contract source**, not just against the list already present in the frontend.

## Example

If a future contract release adds `NewCondition = 14` and publishes what condition it represents, add a `14` entry to `CONTRACT_ERROR_MESSAGES`, extend `CONTRACT_ERROR_CODES` with `14`, and advance `NEXT_UNUSED_CODE` to the next unused code. Verify the concrete wording against that contract release **before** shipping. This example is illustrative; code `14` is currently unassigned.
