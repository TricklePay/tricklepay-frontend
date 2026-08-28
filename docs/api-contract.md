# Frontend API contract

The frontend talks to two independent backends, and code calling either one
should not assume anything about the other:

1. **tricklepay-backend** — a read-only REST API, indexed off-chain, used for
   everything the app *displays* (`lib/api.ts`).
2. **The Soroban stream contract** — invoked directly for everything the app
   *writes* (`lib/contract.ts`). Reads are never served from the contract
   directly; a write is expected to show up through the backend on the next
   fetch, once the indexer catches up.

This split matters for correctness: after a successful `withdraw` or
`cancel`, the frontend does not trust the value it just wrote — it re-fetches
the stream from the backend (see `onComplete` in `components/stream-actions.tsx`)
and renders whatever comes back, including a value that briefly still shows
the pre-transaction state if the indexer hasn't caught up yet.

## 1. Backend read API

Base URL: `NEXT_PUBLIC_API_URL` (see `lib/config.ts`).

### `GET /streams`

Query parameters (all optional, all handled by `listStreams` in `lib/api.ts`):

| Param | Type | Meaning |
| --- | --- | --- |
| `sender` | Stellar address | Only streams sent by this account. |
| `recipient` | Stellar address | Only streams received by this account. |
| `limit` | integer | Page size. |
| `offset` | integer | Page offset. |

The frontend only ever sets one of `sender`/`recipient` per request (a
dashboard's "incoming" and "outgoing" sections are two separate calls — see
`hooks/use-stream-page.ts`); it never asks the backend to filter by both at
once.

Response body — `StreamListResponse` (`types/stream.ts`):

```ts
{
  streams: StreamView[],
  total: number,   // total matches across every page, not streams.length
  limit: number,
  offset: number,
}
```

`total` is what drives the dashboard's "Load more (N remaining)" affordance —
it is not derivable from `streams.length` alone once a filter is applied
client-side.

### `GET /streams/:id`

Response body: a single `StreamView`, or an empty `404` if no stream with
that id exists. `getStream` (`lib/api.ts`) turns that specific case into a
resolved `null` rather than a thrown error — callers branch on `null` to
render the not-found state (`app/streams/[id]/page.tsx`), not on a caught
exception. Any other non-2xx status still throws.

### `StreamView` field contract

```ts
interface StreamView {
  id: string;
  sender: string;      // Stellar G... address
  recipient: string;    // Stellar G... address
  token: string;         // Stellar C... contract address (the SEP-41 token)
  totalAmount: string;   // base units, see "Amount encoding" below
  withdrawn: string;
  vested: string;
  withdrawable: string;
  locked: string;
  startTime: string;    // Unix seconds
  endTime: string;
  cliffTime: string;
  cancelled: boolean;
  status: "pending" | "streaming" | "completed" | "cancelled";
  progress: number;     // basis points (0–10000) of totalAmount vested
}
```

**Amount encoding.** `totalAmount`, `withdrawn`, `vested`, `withdrawable`,
and `locked` are all decimal integers in base units, sent as *strings* —
never as a JSON number. The contract's amounts are `i128`, which overflows
`Number`'s safe integer range well within realistic stream sizes, so every
consumer must parse them with `BigInt(...)`, not `Number(...)` or `parseInt`.
`lib/format.ts`'s `formatAmount` is the one place that turns a base-unit
string into a human decimal (dividing by `10n ** 7n`, the Stellar stroop
convention) — new UI should call that rather than re-implementing the
division.

**Time encoding.** `startTime`/`endTime`/`cliffTime` are Unix-second
timestamps, also sent as strings for the same reason (consistency with the
amount fields, and to avoid every backend integer field needing its own
special case). `lib/format.ts`'s `formatTime` renders them.

**`progress` vs `vested`/`totalAmount`.** `progress` is a convenience the
backend precomputes so simple UI (e.g. a progress bar) doesn't need to do
`vested / totalAmount` itself with `BigInt` division. It is *not* the source
of truth for the vested amount — `vested` is. `hooks/use-accrual.ts`
recomputes `vested`/`withdrawable` client-side every second between fetches
(mirroring the contract's linear-vesting math in `lib/vesting.ts`) so a
streaming balance visibly climbs without polling; `progress` is only used
for the static bar, not for that live recomputation.

### Response validation

Both responses are validated at the boundary before `lib/api.ts` hands them
back — `parseStreamListResponse` and `parseStreamView` in `lib/api-schema.ts`
check every field documented above against the contract, and throw an
`ApiResponseError` naming the offending path (e.g. `response.streams[3].vested
must be a decimal integer string`) when the backend drifts from it. Without
that check a `totalAmount` sent as a JSON number instead of a string surfaces
much later as an opaque `BigInt` conversion failure inside
`lib/format.ts`, and a missing field renders as `undefined` in the table.

Two deliberate leniencies keep older backend builds working:

- `cancelled` is only type-checked when present — `status === "cancelled"`
  already carries the same information.
- `limit`/`offset` are only checked when present, since the frontend paginates
  from its own counters (`hooks/use-stream-page.ts`) rather than from the
  echoed values.

Validation asserts, it never normalises: the payload is returned exactly as it
arrived, so nothing downstream depends on having passed through the validator.
A body that is not JSON at all (an HTML error page from a proxy, an empty
`200`) raises the same `ApiResponseError`, so callers have a single failure
mode for "the backend did not answer with what it promised" — distinct from
the plain `Error` thrown for a non-2xx status.

### Request cancellation

Both read calls accept a `RequestOptions` argument carrying an optional
`AbortSignal` (`listStreams(params, { signal })`, `getStream(id, { signal })`),
which is handed straight to `fetch`. Every caller in the app supplies one and
aborts it when the result stops being wanted:

- `hooks/use-stream-page.ts` keeps the controllers for its unsettled requests
  in a set and aborts them when the query changes (a different address, role,
  or status filter), when `refresh()` starts a replacement load, and on
  unmount. The existing generation counter still guards *writes*; the signal
  additionally drops the connection, which is what stops superseded page loads
  from queueing against the browser per-host connection limit ahead of the
  request that matters.
- `app/streams/[id]/page.tsx` aborts the detail fetch when the id changes or
  the page unmounts, and aborts any outstanding background poll on teardown.

An abort rejects with an error named `AbortError`. Since that is an expected
outcome rather than a failure, `isAbortError(error)` (`lib/api.ts`) identifies
it and every caller swallows it — no error banner is shown for a request the
app cancelled itself, and no loading flag is cleared on behalf of the request
that superseded it. It is matched by `name` rather than `instanceof
DOMException` so it is recognised under undici and jsdom as well as in the
browser. An abort that lands mid-body (while `res.json()` is still reading)
propagates as the same `AbortError`, never as an `ApiResponseError`.

Cancellation is confined to these read calls: writes go through
`lib/contract.ts`, where a submitted transaction cannot be recalled, so nothing
in the wallet or transaction path is abortable.

### Request timeout

Every read carries a deadline, so an unreachable or stalled backend surfaces as
an actionable error instead of a skeleton that never resolves. The budget comes
from `NEXT_PUBLIC_API_TIMEOUT_MS` (`config.apiTimeoutMs`, default `10000`), and
a single call can override it with `RequestOptions.timeoutMs`. `0` — in either
place — disables the timeout.

The value is parsed and validated in `lib/config.ts` at module load, alongside
the contract id: a non-integer or negative value is a startup error naming the
variable, not a silent fallback to the default.

Exceeding the budget throws an `ApiTimeoutError` naming the resource and the
elapsed budget ("Timed out loading stream 42 after 7.5s…"). It is deliberately
*not* an abort: `isAbortError` returns false for it, so the callers that
swallow cancellations still show it, while `isTimeoutError` identifies it for
anything that wants to special-case a slow backend. The timeout covers the
whole exchange, body decoding included, so a backend that sends headers
promptly and then stalls mid-body still times out.

Internally the timeout and the caller signal are merged into one
`AbortController` — a request has only one signal, and either source aborting
must abort the request. `AbortSignal.timeout()` is not used, because its
rejection is indistinguishable from a caller abort at the catch site, which is
exactly the distinction the two error types exist to preserve.

Only the read API is affected. On-chain writes keep their own budget:
`confirm()` in `lib/contract.ts` polls 30 times at one-second intervals and
throws `TransactionTimeoutError` carrying the transaction hash, since a
submitted transaction can still succeed after the frontend stops waiting and
must stay recoverable.

## 2. On-chain contract surface

The frontend calls the deployed stream contract (`NEXT_PUBLIC_CONTRACT_ID`)
directly over Soroban RPC (`NEXT_PUBLIC_RPC_URL`), building, simulating, and
submitting transactions with `@stellar/stellar-sdk` and signing them via
Freighter (`@stellar/freighter-api`). `lib/contract.ts` is the only module
that does this — no other file builds a transaction.

### Entry points invoked

| Function (`lib/contract.ts`) | Contract entry point | Arguments |
| --- | --- | --- |
| `createStream(params)` | `create_stream` | `sender: Address, recipient: Address, token: Address, total_amount: i128, start_time: u64, end_time: u64, cliff_time: u64` |
| `withdraw(caller, streamId)` | `withdraw` | `stream_id: u64` — withdraws the full currently-vested balance |
| `withdrawAmount(caller, streamId, amount)` | `withdraw_amount` | `stream_id: u64, amount: i128` — withdraws a specific amount, not necessarily the full vested balance |
| `cancel(caller, streamId)` | `cancel` | `stream_id: u64` — sender-only |

Every one of these resolves to the **transaction hash** (a `string`) on
success, once `confirm()` has polled the transaction to `SUCCESS` — none of
them decode the contract call's own return value (e.g. the new stream id
`create_stream` returns on-chain). The frontend deliberately does not depend
on that return value: after a write, it relies on the backend indexer
picking up the new/changed stream and re-fetches from the read API instead
(`onComplete()` in `components/stream-actions.tsx`, the redirect-then-notice
flow in `components/create-form.tsx`). A contract change to what a call
returns would not need any frontend change unless the *arguments* also
changed.

### Transaction lifecycle

Every call above goes through `invoke()` in `lib/contract.ts`, in this fixed
order, each step reported via an optional `onStageChange(stage: TxStage)`
callback (`"preparing" | "signing" | "submitting" | "confirming"`,
surfaced by `components/transaction-progress.tsx`):

1. **Network guard** — Freighter's `getNetwork()` is checked against
   `config.network` *before* touching the RPC at all; a mismatch throws
   immediately with an actionable message instead of a wallet-signing prompt
   that would only fail afterward.
2. **Preparing** — `TransactionBuilder` assembles the operation,
   `prepareTransaction` simulates it and computes the Soroban resource
   footprint. A simulation revert is parsed for an `Error(Contract, #N)`
   token (see § 3) and re-thrown as a plain-language message.
3. **Signing** — the prepared XDR is handed to Freighter's
   `signTransaction`. A user rejection in the wallet throws
   `"Signing was rejected in the wallet."`.
4. **Submitting** — the signed transaction is sent via `sendTransaction`.
5. **Confirming** — `confirm()` polls `getTransaction` by hash, once a
   second, up to 30 times. A contract-side failure is parsed the same way as
   a simulation revert; running out of attempts throws
   `TransactionTimeoutError`, which carries the `txHash` so the caller can
   offer to re-check it later without re-submitting — see
   `confirmTransaction(hash, onStageChange)`, the standalone recovery path
   used when a confirmation times out.

**Single in-flight invocation.** `invoke()` refuses to start a second
transaction while one is already in flight (`isTransactionPending()`) —
callers don't need their own separate "already submitting" guard for this
specific race, though components still track their own `busy` state for UI
purposes (disabling the right button, showing the right label).

## 3. Error contract

A contract-side revert (from simulation, or from a failed confirmed
transaction) is surfaced to the SDK as a string containing an
`Error(Contract, #N)` token. `lib/contract-errors.ts`'s
`parseContractError` extracts `N` and maps it to a user-facing message:

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

This table mirrors `StreamError` in the contract's `error.rs` — if the
contract adds, removes, or renumbers a variant, this table (and
`lib/contract-errors.test.ts`, which asserts the table's key set exactly)
needs updating to match. A code with no entry falls back to a generic
`"The transaction failed on-chain."`, with the raw code appended for
debugging (`"... (error code 99)"`), rather than surfacing nothing.

## 4. Configuration contract

Both surfaces above are pointed at their targets entirely through
`NEXT_PUBLIC_*` environment variables — including `NEXT_PUBLIC_API_TIMEOUT_MS`,
the read API request budget described above — read once in `lib/config.ts`; see the
README's [Configuration](../README.md#configuration) section for the full
variable list and defaults. Because these are `NEXT_PUBLIC_*` vars, they're
inlined at build time — pointing the same build at a different backend or
contract deployment requires a rebuild, not just a restart.
