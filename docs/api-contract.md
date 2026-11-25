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

Query parameters are optional on the backend. The table distinguishes what
`listStreams` in `lib/api.ts` sends from what the backend supports:

| Param | Type | Backend meaning and current client behavior |
| --- | --- | --- |
| `sender` | Stellar address | Only streams sent by this account; sent for the outgoing list. |
| `recipient` | Stellar address | Only streams received by this account; sent for the incoming list. |
| `limit` | integer | Page size; the dashboard sends its selected page size. |
| `offset` | integer | Offset pagination; serialized when supplied to `listStreams`, but not used by the dashboard's cursor pagination. |
| `cursor` | string | Opaque pagination cursor; the dashboard sends the previous response's `nextCursor` when loading more. Omitted for the first page and refreshes. |
| `includeTotal` | boolean | Requests the matching row count when `true`; the backend omits `total` by default. The dashboard sends `includeTotal=true` on each page request. |
| `cancelled` | boolean | Backend filter for cancellation state. The current `ListStreamsParams` does not expose or serialize it. |
| `status` | `pending`, `streaming`, `completed`, or `cancelled` | **Unsupported by the backend.** The current client nevertheless sends this parameter for a selected status; `"all"` and `undefined` omit it. Do not rely on it for backend filtering; this is a client/backend mismatch. |

The frontend only ever sets one of `sender`/`recipient` per request (a
dashboard's "incoming" and "outgoing" sections are two separate calls — see
`hooks/use-stream-page.ts`); it never asks the backend to filter by both at
once.

Response body — `StreamListResponse` (`types/stream.ts`), with the optional
fields accepted by the frontend validator:

```ts
interface StreamListResponse {
  streams: StreamView[]; // required; each row follows the field contract below
  total?: number;       // only returned with includeTotal=true
  nextCursor?: string;  // continuation cursor, when another page is available
  limit?: number;       // optional echoed pagination metadata
  offset?: number;      // optional echoed pagination metadata
}
```

`total` counts matches across every page, not just `streams.length`. The
dashboard uses it for the remaining count and falls back to the number of
loaded rows when it is absent. `nextCursor` drives whether "Load more" is
available; a response without it ends pagination even if `total` is larger
than the loaded count. The client passes a returned cursor back unchanged.
It does not need echoed `limit` or `offset` to paginate.

### `GET /streams/:id`

Response body: a single `StreamView`, or an empty `404` if no stream with
that id exists. `getStream` (`lib/api.ts`) turns that specific case into a
resolved `null` rather than a thrown error — callers branch on `null` to
render the not-found state (`app/streams/[id]/page.tsx`), not on a caught
exception. Any other non-2xx status still throws.

### `GET /streams/:id/events`

Response body: a JSON array of `StreamEvent` objects (`types/stream.ts`) for
one stream, in ascending chain order. Each event carries `eventId` (the
ordering key), `kind` (`created`, `withdrawn` or `cancelled`), `streamId`,
`ledger` and `txHash`, plus optional amount and time fields that depend on the
kind (for example `totalAmount` on `created`, `amount` on `withdrawn`,
`recipientAmount` and `senderRefund` on `cancelled`). Amounts and times are
decimal strings.

`getStreamEvents` (`lib/api.ts`) validates the body with `parseStreamEvents`.
Events with unrecognized string `kind` values are omitted; supported events
continue to render in their original order. Malformed supported events still
fail validation.
A `404`, or an id that is not a valid stream id, resolves to an empty array
instead of throwing. Any other non-2xx status throws an `ApiError`.

### Error body and headers

A non-2xx response from the backend is expected to carry a JSON body:

| Field | Meaning |
| --- | --- |
| `code` | Machine-readable error code, kept on `ApiError.code` |
| `error` | Human-readable message, used as the `ApiError` message when present |
| `requestId` | Backend request id, kept on `ApiError.requestId` and shown to the user for support |

`createApiError` (`lib/api.ts`) tolerates a missing or non-JSON body and falls
back to a message built from the HTTP status. The backend also reports how far
the indexer is behind the chain in the `X-Indexer-Lag-Ledgers` header; the
client currently reads the same value as `lagLedgers` from `GET /status`
(`getIndexerLag`) to drive the indexer lag banner.

Recorded error bodies are in `test/fixtures/api/error-400.json`,
`error-404.json` and `error-429.json`. See
[Recording and updating backend fixtures](#recording-and-updating-backend-fixtures).

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

**Token symbol resolution.** The frontend trims the `token` contract address
and performs an exact lookup in the static metadata map in `lib/format.ts`.
There is no network metadata lookup or other fallback. The currently known
contract is the USDC contract, which resolves to the `USDC` symbol. For an
unknown contract, token identity displays the truncated address (for example,
`CABC...4567`) followed by **Unrecognised token**. Amounts for unknown tokens
show only the formatted number, while rates use the generic `tokens` label.

**Amount encoding.** `totalAmount`, `withdrawn`, `vested`, `withdrawable`,
and `locked` are all decimal integers in base units, sent as *strings* —
never as a JSON number. The contract's amounts are `i128`, which overflows
Number's safe integer range well within realistic stream sizes, so every
consumer must parse them with `BigInt(...)`, not `Number(...)` or `parseInt`.
`lib/format.ts`'s `formatAmount` is the one place that turns a base-unit
string into a human decimal (dividing by `10n ** 7n`, the Stellar stroop
convention) — new UI should call that rather than re-implementing the
division.

**Time encoding.** `startTime`/`endTime`/`cliffTime` are Unix-second
timestamps, also sent as strings for the same reason (consistency with the
amount fields, and to avoid every backend integer field needing its own
special case). `lib/format.ts`'s `formatTime` renders them.

**`progress` vs `vested` / `totalAmount`.** `progress` is a convenience the
backend precomputes so simple UI (e.g. a progress bar) doesn't need to do
`vested / totalAmount` itself with `BigInt` division. It is *not* the source
of truth for the vested amount — `vested` is. `hooks/use-accrual.ts`
recomputes `vested` / `withdrawable` client-side every second between fetches
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

The validator accepts these optional fields:

- `cancelled` is only type-checked when present — `status === "cancelled"`
  already carries the same information.
- `total` is only checked when present, since the backend only returns it
  with `includeTotal=true`.
- `nextCursor` is only checked when present and must be a string. Its absence
  means there is no continuation for the dashboard to request.
- `limit`/`offset` are only checked when present, since the frontend follows
  `nextCursor` (`hooks/use-stream-page.ts`) rather than the echoed values.

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

The value is parsed and validated in `lib/config.ts` at module load, alongside the
contract id: a non-integer or negative value is a startup error naming the
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

### Error categories and client handling

Every failure from the read API falls into one of a small set of categories.
The client branches on these categories in a single place, and each one has a
distinct user-visible outcome. A contributor adding a branch should match an
existing category rather than invent a new one.

| Category | Type | Triggered by | User sees |
| --- | --- | --- | --- |
| **Not found** | resolved `null` | `GET /streams/:id` with a `404` | The stream detail page renders its "stream not found" state; no error banner. |
| **Cancelled** | `AbortError` | The app aborted the request itself (query change, refresh, unmount) | Nothing. The request is swallowed by `isAbortError`; no banner, no loading flag change. |
| **Timeout** | `ApiTimeoutError` | The read exceeded `info.apiTimeoutMs` (or the per-call override) | An error banner naming the resource and the elapsed budget, e.g. "Timed out loading stream 42 after 7.5s". |
| **Response shape** | `ApiResponseError` | The body failed `parseStreamListResponse`/`parseStreamView`, or was not JSON at all (non-2xx status excluded) | An error banner with the validator's path message, e.g. `response.streams[3].vested must be a decimal integer string`. |
| **HTTP status** | plain `Error` | Any other non-2xx status from the backend | An error banner with the status text. |

The branch order matters: `AbortError` is checked first and swallowed,
then `ApiTimeoutError` and `ApiResponseError` are surfaced as banners, and
everything else falls through to the generic `Error` handler. A new branch that
duplicates an existing category will either be unreachable or produce a second
banner for the same failure.

### Recording and updating backend fixtures

The unit tests in `lib/api-backend-fixtures.test.ts` validate `parseStreamListResponse`, `parseStreamView`, and client error handling against authentic responses recorded from a running `tricklepay-backend` instance.

Fixtures live in `test/fixtures/api/`. To re-record or update them:

1. Start `tricklepay-backend` locally (defaults to `http://localhost:3000`).
2. Run the commands that produce each fixture:
   ```bash
   # List with total
   curl -s "http://localhost:3000/streams?limit=25&offset=0&includeTotal=true" > test/fixtures/api/list-with-total.json

   # List without total (omitted by default)
   curl -s "http://localhost:3000/streams?limit=25&offset=0" > test/fixtures/api/list-without-total.json

   # Stream detail
   curl -s "http://localhost:3000/streams/1" > test/fixtures/api/stream-detail.json

   # 400 Bad Request
   curl -s "http://localhost:3000/streams?unknownParam=1" > test/fixtures/api/error-400.json

   # 404 Not Found
   curl -s "http://localhost:3000/streams/nonexistent-stream-999" > test/fixtures/api/error-404.json

   # 429 Too Many Requests
   curl -s "http://localhost:3000/streams" > test/fixtures/api/error-429.json
   ```
3. Run `npm test` to verify that the schema parser and API client tests succeed against the updated fixtures.

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

A sequence diagram of these steps, marking where each failure is raised, is
in [transaction-write-path.md](transaction-write-path.md).

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
   footprint. A simulation revert is parsed for an `Error(Contract, #N)` token
   (see § 3) and re-thrown as a plain-language message.
3. **Signing** — the prepared XDR is handed to Freighter's
   `signTransaction`. A user rejection in the wallet throws
   `"Signing was rejected in the wallet."`.
4.
