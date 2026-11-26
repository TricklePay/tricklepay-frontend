# API error handling

The frontend has two independent failure surfaces, matching the two backends
described in [api-contract.md](api-contract.md): the read-only
tricklepay-backend REST API, and the on-chain Soroban stream contract. Each
has its own small set of error categories, its own mapping code, and its own
user-visible outcome. This document collects both into one place; the pieces
individually also appear in api-contract.md.

## 1. Backend read API errors

Every failure from `listStreams`/`getStream` (`lib/api.ts`) falls into one of
five categories. The client branches on these categories in a single place,
and a contributor adding a branch should match an existing category rather
than invent a new one.

| Category | Type | Triggered by | User sees |
| --- | --- | --- | --- |
| **Not found** | resolved `null` | `GET /streams/:id` with a `404` | The stream detail page renders its "stream not found" state; no error banner. |
| **Cancelled** | `AbortError` | The app aborted the request itself (query change, refresh, unmount) | Nothing. Swallowed by `isAbortError` (`lib/api.ts`); no banner, no loading flag change. |
| **Timeout** | `ApiTimeoutError` | The read exceeded `config.apiTimeoutMs` (or a per-call `RequestOptions.timeoutMs` override) | An error banner naming the resource and the elapsed budget, e.g. "Timed out loading stream 42 after 7.5s". |
| **Response shape** | `ApiResponseError` | The body failed `parseStreamListResponse`/`parseStreamView` (`lib/api-schema.ts`), or was not JSON at all (non-2xx status excluded) | An error banner with the validator's path message, e.g. `response.streams[3].vested must be a decimal integer string`. |
| **HTTP status** | plain `Error` | Any other non-2xx status from the backend | An error banner with the status text. |

The branch order matters: `AbortError` is checked first and swallowed, then
`ApiTimeoutError` and `ApiResponseError` are surfaced as banners, and
everything else falls through to the generic `Error` handler. A new branch
that duplicates an existing category will either be unreachable or produce a
second banner for the same failure.

### Where each category is caught and shown

| Call site | Catches with | Renders |
| --- | --- | --- |
| `hooks/use-stream-page.ts` (dashboard list, first page/load-more) | `isAbortError(err)` to swallow cancellations; everything else becomes `page.error` | `app/page.tsx`: `<p>{page.error}</p>` plus a **Retry** button that calls `page.refresh`. |
| `app/streams/[id]/page.tsx` (stream detail, initial load) | Same `isAbortError` check; everything else becomes `error` | A `role="alert"` message plus a **Retry** button that bumps `reloadKey` to refetch. |
| Background/silent refetches (`use-stream-page.ts`'s periodic refresh, the detail page's focus/visibility/interval poll) | Catches and discards every failure, including non-abort ones | Nothing — the screen keeps showing the last good data rather than replacing it with an error for a refresh nobody asked for. |

The dashboard list has one extra wrinkle the detail page does not: a failed
*first-page* fetch is retried once automatically (`FIRST_PAGE_MAX_ATTEMPTS`,
`FIRST_PAGE_RETRY_DELAY_MS` in `use-stream-page.ts`) before `page.error` is
set at all, on the theory that most single failures are a transient blip
(dropped connection, momentary 5xx) that clears itself. When a response
includes a `Retry-After` header (such as a `429 Too Many Requests`),
`createApiError` exposes the parsed delay on `ApiError.retryAfter` and
`use-stream-page.ts` waits at least that long before retrying the first page or
running the next background/focus list refresh. `load-more` requests
and the stream detail page's initial load do not get this retry — they
surface on the first failure.

## 2. On-chain / transaction errors

Writes (`createStream`, `withdraw`, `withdrawAmount`, `cancel` in
`lib/contract.ts`) can fail at several distinct points in the invocation
lifecycle described in api-contract.md § "Transaction lifecycle". Each point
has its own message, defined in `lib/contract-messages.ts` unless noted:

| Stage | Failure | Message shown |
| --- | --- | --- |
| Before preparing | Another invocation is already in flight (`isTransactionPending()`) | `TX_ALREADY_IN_PROGRESS_MESSAGE` — "A transaction is already in progress. Please wait for it to complete." |
| Before preparing | Freighter's active network doesn't match `config.network` | `wrongNetworkMessage(wallet, expected)` — "Wrong network: wallet is on testnet, app expects mainnet. Switch networks in Freighter." |
| Preparing (simulation) | The simulated call reverts | The contract-error message, see below. |
| Signing | The user rejects in Freighter, or the prepared XDR expired | `TX_SIGNING_REJECTED_MESSAGE` — "Signing was rejected in the wallet." |
| Submitting | The RPC rejects the broadcast outright (expired XDR, duplicate submission, fee too low) | `TX_NETWORK_REJECTED_MESSAGE` — "The network rejected the transaction." |
| Confirming | The confirmed transaction failed on-chain | The contract-error message, see below. |
| Confirming | Polling exhausts its 30 one-second attempts without a result | `TransactionTimeoutError` (`lib/contract.ts`), carrying the transaction hash — see "Confirmation timeout" below. |
| Anything else unexpected | A throw that isn't one of the above | A stage-specific fallback: `TX_FAILED_WITHDRAW_MESSAGE`, `TX_FAILED_CANCEL_MESSAGE`, `TX_FAILED_CONFIRM_MESSAGE`, or `TX_FAILED_CREATE_MESSAGE`. |

### Contract-revert errors: `parseContractError`

A contract-side revert (from simulation, in `lib/contract-transaction.ts`, or
from a failed confirmed transaction, in `lib/contract-confirm.ts`) is surfaced
by the SDK as a string containing an `Error(Contract, #N)` token.
`parseContractError` (`lib/contract-errors.ts`) extracts `N` and maps it to a
user-facing message:

| Code | Meaning | Message shown |
| --- | --- | --- |
| 1 | `StreamNotFound` | "Stream not found." |
| 2 | `Unauthorized` *(retired; kept for streams on older deployed contracts)* | "You are not authorized to perform this action." |
| 3 | `InvalidTimeRange` | "Invalid time range — the stream must start before it ends." |
| 4 | `InvalidAmount` | "Invalid amount — the total must be greater than zero." |
| 5 | `InvalidCliff` | "Invalid cliff — the cliff must fall between the start and end times." |
| 6 | `AlreadyCancelled` | "This stream has already been cancelled." |
| 7 | `NothingToWithdraw` | "Nothing to withdraw yet — no tokens have vested since your last withdrawal." |
| 8 | `InsufficientBalance` | "That is more than you can withdraw right now." |
| 9 | `StreamAlreadyCompleted` | "This stream has already completed and can no longer be cancelled." |
| 10 | `AmountTooLarge` | "That amount is too large. The total must not exceed 9223372036854775807." |
| 11 | `StreamWindowInPast` | "The stream's end time has already passed — choose an end time in the future." |
| 12 | `StreamCountExhausted` | "No new streams can be created on this contract — it has run out of stream ids." |
| 13 | `InvalidParticipant` | "Invalid participants — the sender and recipient must be different accounts, and neither can be the token or the stream contract." |

This table mirrors `StreamError` in the contract's `error.rs` — if the
contract adds, removes, or renumbers a variant, this table (and
`lib/contract-errors.test.ts`, which asserts the table's key set exactly)
needs updating to match — see
[adding-contract-error-messages.md](adding-contract-error-messages.md) for the
full checklist. A code with no entry falls back to the generic
`GENERIC_FAILURE` — "The transaction failed on-chain." — with the raw code
appended for debugging ("... (error code 99)"), rather than surfacing
nothing. A string with no `Error(Contract, #N)` token at all maps to the same
generic message without a code.

**Token vs. stream contract.** Codes are only meaningful relative to the
contract that raised them. A failed token transfer (e.g. the sender can't
cover the amount) also reverts with a small integer, and the Stellar Asset
Contract's own codes can collide with the stream contract's — its
`BalanceError` is `10`, the same number as the stream contract's
`AmountTooLarge`. `parseContractError` reads the diagnostic events to find
which contract id raised the matching code; when it names a contract other
than the configured stream contract, `tokenFailureMessage(code)` is used
instead of the table above — "The token contract rejected the transfer.
Check that your balance covers the amount, then try again. (token error code
10)". Text that doesn't say which contract failed is mapped as the stream
contract's.

### Confirmation timeout

Running out of confirmation attempts doesn't mean the transaction failed — it
may still settle, since it was already submitted. `TransactionTimeoutError`
carries the transaction hash so the UI can offer a recheck instead of a
blind retry:

- On a withdraw/cancel/confirm's *first* timeout, `TX_CONFIRMATION_TIMED_OUT_SUBMITTED_MESSAGE`
  is shown — "Confirmation timed out. The transaction was submitted to the
  network." `components/timeout-recovery-alert.tsx` then offers a **Recheck**
  action that calls `confirmTransaction(hash, onStageChange)`, the standalone
  recovery path that re-polls without re-submitting.
- If that recheck also times out, `TX_CONFIRMATION_TIMED_OUT_AGAIN_MESSAGE`
  is shown instead — "Confirmation timed out again. Check explorer or try
  again later." — since repeated recovery attempts stop being useful.

### Where transaction errors are caught and shown

| Call site | Renders |
| --- | --- |
| `hooks/use-stream-actions.ts` (withdraw, cancel, confirm-after-timeout on the detail page) | `role="alert"` text via `StreamActions`; see `components/stream-actions.tsx`. |
| `hooks/use-create-stream-form.ts` (create-stream submission and timeout recovery) | `{form.error && <p role="alert">{form.error}</p>}` in `components/create-form.tsx`. |

In both hooks the pattern is the same: catch, check
`err instanceof TransactionTimeoutError` first (to pick the submitted-vs-timed-out-again
message and stash the hash for `timeout-recovery-alert.tsx`), then fall back
to `err.message` — which is already the plain-language string by the time it
reaches the hook, since `parseContractError` runs inside `lib/contract.ts`
before the error leaves it — or, when the error isn't an `Error` at all, the
stage-specific `TX_FAILED_*` constant.

## Where the code lives

| Concern | Module |
| --- | --- |
| Backend error types (`ApiTimeoutError`, `isAbortError`, `isTimeoutError`) | `lib/api.ts` |
| Backend response-shape validation (`ApiResponseError`) | `lib/api-schema.ts` |
| Contract error code table and `parseContractError`/`tokenFailureMessage` | `lib/contract-errors.ts` |
| Transaction-lifecycle user copy (stage labels, signing/network/timeout messages) | `lib/contract-messages.ts` |
| Where `parseContractError` is actually invoked (simulation revert, confirmed-failure revert) | `lib/contract-transaction.ts`, `lib/contract-confirm.ts` |
| Stream action blocked-reason copy (not an error path — see below) | `lib/stream-messages.ts` |

`lib/stream-messages.ts` is a related but separate concern: it explains why
an action is *disabled* (fully withdrawn, cancelled, locked until a cliff
date), not why a request *failed*. Nothing there is caught from a thrown
error.
