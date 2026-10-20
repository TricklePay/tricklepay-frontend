# Create-stream form validation

The client rejects bad input before it ever builds a transaction, so anything you
send to the network has already passed the rules below. This is the full list,
field by field, with the exact message you see for each failure.

- [1. Where the rules live](#1-where-the-rules-live)
- [2. When a rule runs](#2-when-a-rule-runs)
- [3. The rules](#3-the-rules)
- [4. What happens once the form is valid](#4-what-happens-once-the-form-is-valid)
- [5. What this list does not cover](#5-what-this-list-does-not-cover)
- [Related documentation](#related-documentation)

---

## 1. Where the rules live

| File | Role |
|---|---|
| `lib/create-stream-validation.ts` | The per-field rules and the required-field messages for this form, plus `validateCreateStreamForm`, which composes them. |
| `lib/validation.ts` | The underlying checks: `isValidStellarAddress`, `isValidContractAddress`, `parseAmount`, and `toUnix`. Shared with the rest of the app. |
| `lib/duration.ts` | The Duration shortcut's own rule (`durationFieldError`) and the calendar arithmetic that turns it into an end time (`addDurationToLocal`). |
| `hooks/use-create-stream-form.ts` | Calls the rules as you type, and re-runs the whole set on submit. |
| `components/create-stream-fields.tsx` | Renders each message under its input, with `aria-invalid` on the field. |

The rules are pure functions returning a message or `undefined`, which is why
they can be unit tested without React (`lib/create-stream-validation.test.ts`).

---

## 2. When a rule runs

**Live, as you type.** `recipient`, `token`, and `amount` are checked on every
change. `end` and `cliff` are re-checked whenever `start` or `end` moves, since
both are judged relative to the window.

**On submit.** Pressing "Review stream" re-runs the complete set through
`validateCreateStreamForm`, so a stale live message can never disagree with what
is accepted. If anything fails, nothing is sent to the wallet: the first invalid
field in screen order — `recipient`, `token`, `amount`, `start`, the Duration
shortcut, `end`, `cliff` — is focused and the review step does not open.

**The empty-field exception.** Clearing `recipient`, `token`, or `amount` does
*not* raise a "required" message while you are still typing — the field simply
goes quiet until you fill it or submit. The two date fields are the exception:
emptying `start` or `end` shows its required message immediately, because an
empty date input is unambiguous.

**One rule is also a button gate.** "Review stream" stays disabled until both
addresses are present and well-formed (`addressesValid` in the hook), and while a
network mismatch is present. A malformed recipient or token therefore shows its
message under the field with the button disabled, rather than being reported on
submit; the `Recipient address is required.` and `Token contract id is required.`
strings are the submit-time safety net for that path.

---

## 3. The rules

Every message below is the literal string the form renders.

### Recipient address

| Rule | Message |
|---|---|
| Must not be empty (submit) | `Recipient address is required.` |
| Must be a Stellar public key (`G...`) or a contract address (`C...`) | `Must be a valid G... or C... Stellar address.` |

The check is the SDK's own `StrKey` validation, so a `G...` address with a broken
checksum is rejected as well.

### Token contract id

| Rule | Message |
|---|---|
| Must not be empty (submit) | `Token contract id is required.` |
| Must be a contract address (`C...`) | `Must be a valid C... contract address.` |

Stricter than the recipient field on purpose: a token is always a contract, so a
`G...` account address is rejected here even though it would pass as a recipient.

### Amount

| Rule | Message | Example that triggers it |
|---|---|---|
| Must not be empty (submit) | `Amount is required.` | `""` |
| Must be a plain non-negative decimal | `Amount must be a positive number (e.g. 100 or 1.5).` | `abc`, `-3`, `+5`, `1e5`, `1.2.3` |
| At most the token's decimal places (7 by default) | `Amount cannot have more than 7 decimal places.` | `100.12345678` for a 7-decimal token |
| Must be greater than zero | `Amount must be greater than zero.` | `0`, `0.0000000` |

Details:

- Surrounding whitespace is trimmed, so `"  5  "` is accepted. A value that is
  *only* whitespace trims to empty and reports `Amount is required.`
- `1e5` and `1.2.3` are rejected rather than coerced; the rule is a single
  `^\d+(\.\d+)?$` match.
- More than the allowed number of decimals is an error, not a silent rounding —
  the field's own hint says "Up to 7 decimal places (e.g. 1.0000001)" for a
  7-decimal token, and the message substitutes the token's actual precision
  when it is known.
- The value stays a string until submit; the conversion to base units happens
  once, in `parseAmount`, using the token's decimals.

### Token decimals

`parseAmount`, `formatAmount`, and `parseHumanAmount` take a `decimals`
argument and **default to 7** (`STROOP_DECIMALS`), the Stellar stroop
convention used by the native asset and most Stellar assets. Seven is an
assumption, not a guarantee for an arbitrary SEP-41 token. If a 6-decimal
token is parsed or formatted with 7 decimals, a base-unit balance is displayed
10 times too small and the human amount the user enters is interpreted as 10
times too large on-chain; each additional place of difference multiplies the
error by 10.

The create form avoids that for the token it is about to stream: it reads
`decimals()` from the token contract and uses the result for the amount rule,
the hint, the rate preview, review, and the submitted `totalAmount`. If the
read fails it falls back to 7 and shows "Could not read token decimals from
contract. Defaulting to 7 decimals." beside the field. Reading the precision
from the contract is the fix tracked by
[#532 — Read a token's decimals from the token contract](https://github.com/TricklePay/tricklepay-frontend/issues/532);
callers that skip that read still inherit the 7-decimal limitation.

Code outside this form that calls the formatting or parsing helpers without a
`decimals` argument inherits the 7-decimal assumption and must pass the
token's real precision when it has one.

### Start

| Rule | Message |
|---|---|
| Must not be empty | `Start date is required.` |

Shown as soon as the field is cleared. The value comes from a `datetime-local`
input in **your** local timezone, and the field shows its UTC equivalent
underneath so you can check it against the stream you intend.

### Duration (optional)

A shortcut, not a field the transaction reads: it only ever fills in `end` from
`start`. Disabled until `start` is filled in.

| Rule | Message | Example that triggers it |
|---|---|---|
| If present, must be a whole number | `Duration must be a whole number (e.g. 30).` | `abc`, `1.5`, `-5`, `1e3` |
| Must be greater than zero | `Duration must be greater than zero.` | `0` |

Details:

- **Two-way sync with End.** Entering "30" + "Days" sets `end` to 30 days after `start`.
  Conversely, editing `end` directly afterwards recalculates the displayed
  Duration to match the new window (matching years, months, weeks, or days),
  keeping both controls in sync.
- **Stays in sync with a moving start.** If `start` changes while a valid
  duration is set, `end` is recomputed from the new `start` — so moving the
  window doesn't leave a stale `end` that no longer matches the duration shown.
- **Calendar arithmetic for months and years.** "1 month" uses the JS `Date`
  object's own `setMonth`, not a fixed 30-day approximation — so it lands on
  the same day next month, with that method's usual day-overflow (adding 1
  month to Jan 31 lands on Mar 3, since February has no 31st).
- **Blocks submission like any other field.** It never reaches the
  transaction — only the `end` it computed does — but an error left showing on
  screen at submit time would be confusing, so an invalid duration still stops
  submission the same as every other field.

### End

| Rule | Message |
|---|---|
| Must not be empty | `End date is required.` |
| Must be strictly after start | `End must be after start.` |

An end equal to the start is rejected too — a zero-length stream would vest
nothing.

### Cliff (optional)

| Rule | Message |
|---|---|
| If present, must fall between start and end | `Cliff must fall between start and end.` |

- **Optional.** Leaving it blank is valid, and the contract then receives
  `cliffTime = startTime`, so vesting starts immediately.
- **Inclusive bounds.** A cliff exactly equal to start or end is accepted; only a
  value strictly outside the window is rejected.
- **Skipped until the window exists.** With `start` or `end` still empty the
  cliff is not judged, because there is nothing to compare it against.
- It is re-checked when `start` or `end` changes, so narrowing the window can
  turn a previously valid cliff into an error.

---

## 4. What happens once the form is valid

Validation passing does **not** send anything. It moves the form to the review
step (`components/stream-review.tsx`), where the exact parameters that will go
on-chain are shown — amount converted to base units using the token's decimals
(7 by default), dates converted to Unix seconds, a blank cliff defaulted to the
start time. Only "Create stream" on that step builds, signs, and submits the
transaction.

---

## 5. What this list does not cover

- **Contract-side rules.** Once submitted, the contract enforces its own
  conditions (already cancelled, nothing to withdraw yet, insufficient balance).
  Those messages come from `lib/contract-errors.ts` and are listed in
  [api-contract.md](api-contract.md#error-categories-and-client-handling).
- **The network guard.** A wrong-network wallet is refused before any field is
  looked at, with `Wrong network: wallet is on <network>, app expects <network>.
  Switch networks in Freighter.` (see [use-network-guard.ts](../hooks/use-network-guard.ts)).
- **The withdraw form's amount rules**, which are a separate set with their own
  messages (`Enter an amount.`, `Amount cannot be negative.`, `Amount exceeds
  withdrawable balance (…)`) in `lib/amount.ts`.
- **Unparseable date strings.** `lib/validation.ts` also contains
  `validateStreamDates` and an `Invalid date input.` error, but they are not
  wired into this form: a `datetime-local` input only ever yields an empty or
  well-formed value, so the form's date rules compare timestamps directly.

---

## Related documentation

- [create-form-draft.md](create-form-draft.md) — a restored draft is not
  re-validated until you edit a field or submit.
- [api-contract.md](api-contract.md#2-on-chain-contract-surface) — the contract
  checks that run after these client-side rules pass.
- [timeout-recovery.md](timeout-recovery.md) — what happens after a valid form's
  transaction does not confirm in time.
- [`lib/create-stream-validation.ts`](../lib/create-stream-validation.ts) — the
  rules themselves, next to their unit test.
