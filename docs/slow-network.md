# Slow network behaviour

This document describes how the client handles a slow network: request timeouts,
caller-driven cancellation, and the recovery path for on-chain transactions that
do not confirm in time.

---

## 1. Backend read requests

All HTTP calls to the backend go through a single internal `request()` function
in `lib/api.ts`. Every call carries two independent abort sources that are merged
into one `AbortController`:

| Source | How it fires | Result |
|---|---|---|
| Deadline timer | `setTimeout` inside `request()` | `ApiTimeoutError` — shown to the user |
| Caller signal | `AbortController` passed in by the caller | `AbortError` — swallowed silently |

The distinction matters: a timeout is a failure the user should see ("the backend
is not answering"), whereas a caller-driven abort is a normal outcome they should
never see.

### Timeout value

The default is **10 seconds** (`DEFAULT_API_TIMEOUT_MS = 10_000` in
`lib/config.ts`). Set `NEXT_PUBLIC_API_TIMEOUT_MS` in your environment to
override it for the whole app; pass `timeoutMs` in `RequestOptions` to override
it for a single call. Setting either to `0` disables the timeout entirely.

The timer starts when `request()` is entered and covers the whole exchange —
response headers **and** body decoding — so a backend that sends headers promptly
and then stalls mid-body still triggers the deadline.

### Why not `AbortSignal.timeout()`

The built-in `AbortSignal.timeout()` produces a rejection that is
indistinguishable from any other abort at the catch site. The manual timer + flag
pattern keeps the two abort sources distinguishable: only an abort that coincides
with `timedOut === true` is promoted to `ApiTimeoutError`.

---

## 2. Cancellation of list fetches

`useStreamPage` (`hooks/use-stream-page.ts`) manages in-flight list requests with
an `inFlight` set of `AbortController` objects. `abortInFlight()` iterates the
set and aborts everything still open. It is called in three situations:

- **Query change** (address, role, or status filter): the `useEffect` that drives
  `loadFirstPage` runs `abortInFlight()` before starting the new set of requests.
- **Component unmount**: the same effect's cleanup function (`return () =>
  abortInFlight()`) fires when the component leaves the tree.
- **Manual refresh**: `loadFirstPage` calls `abortInFlight()` at the top before
  incrementing the generation counter.

A **generation counter** (`generation` ref) provides a second layer of safety.
Each request records the generation it started under and compares it against the
current one before writing any state. A response that races past the abort still
cannot overwrite a newer query's list.

Aborting on a slow link is especially important when there are multiple superseded
page loads queued against the browser's per-host connection limit: cancelling
stale requests unblocks the connection for the one that actually matters.

### Background auto-refresh

`silentRefresh` runs every 15 seconds, on window focus, and on tab visibility
change. Its `.catch()` handler swallows all errors, including timeouts, so a
background poll failure never flashes an error to the user. Existing rows stay on
screen until a successful refresh replaces them.

---

## 3. On-chain transaction confirmation

Soroban transactions are not confirmed synchronously. After a transaction is
submitted the client must poll `getTransaction` until the status changes from
`PENDING`. This is a separate budget from the HTTP timeout.

### Polling constants (`lib/contract.ts`)

```
CONFIRM_POLL_INTERVAL_MS = 1_000   // poll every 1 second
CONFIRM_POLL_ATTEMPTS    = 30      // give up after 30 attempts (~30 seconds)
TX_TIMEOUT_SECONDS       = 60      // validity window built into the XDR envelope
```

The `confirm()` function loops up to 30 times, sleeping one second between each
`getTransaction` call. Possible outcomes:

- **`SUCCESS`** — returns the transaction hash.
- **`FAILED`** — extracts a contract error code from the diagnostic XDR events
  and throws a human-readable `Error` (e.g. "Nothing to withdraw yet").
- **30 attempts exhausted** — throws `TransactionTimeoutError`, carrying the
  submitted transaction's hash.

`TransactionTimeoutError` carries the hash because the transaction **was already
submitted to the network** — it simply did not confirm within the polling window.
Re-submitting would be wrong; the hash is kept so the client can re-poll instead.

---

## 4. Confirmation timeout recovery

When `runWithdraw()` or `runCancel()` in `useStreamActions`
(`hooks/use-stream-actions.ts`) catches a `TransactionTimeoutError`:

1. `timeoutHash` is set to the submitted transaction's hash.
2. `error` is set to "Confirmation timed out. The transaction was submitted to
   the network."
3. `busy` and `stage` are reset to `null` so the UI unblocks.

`StreamActions` (`components/stream-actions.tsx`) renders `TimeoutRecoveryAlert`
whenever `timeoutHash` is non-null. The alert (`components/timeout-recovery-alert.tsx`)
carries `role="alert"` so screen readers announce it immediately, and offers two
actions:

| Action | What it does |
|---|---|
| **Re-check status** | Calls `recoverTimeout()`, which re-runs the 30-attempt polling loop via `confirmTransaction()` — no re-submission |
| **View on Stellar Expert** | Opens the explorer URL for the submitted hash in a new tab |

The "Re-check status" button is disabled while any other action is in flight.

### `recoverTimeout()` flow

```
recoverTimeout()
  └─ confirmTransaction(timeoutHash)   // lib/contract.ts — re-runs confirm() loop
       ├─ SUCCESS  → clear timeoutHash, set lastTxHash, call onComplete()
       └─ TIMEOUT  → "Confirmation timed out again. Check explorer or try again."
                     timeoutHash stays set so the explorer link remains available
```

A second timeout leaves the alert in place with an updated error message so the
user still has the explorer link available.

---

## Summary

| Situation | Mechanism | User-visible result |
|---|---|---|
| Backend slow or unreachable | Deadline timer in `lib/api.ts` | `ApiTimeoutError` with a message naming the resource and elapsed time |
| User navigates away or changes filter | `abortInFlight()` in `useStreamPage` | Silent — `isAbortError` swallows it |
| Background auto-refresh fails | Silent `.catch()` in `silentRefresh` | Nothing shown; existing rows stay on screen |
| On-chain confirmation stalls | 30-poll loop exhausted → `TransactionTimeoutError` | Amber `TimeoutRecoveryAlert` with re-check and explorer actions |
| Re-check also times out | `TransactionTimeoutError` caught again in `recoverTimeout` | Updated error message; alert and explorer link stay visible |
