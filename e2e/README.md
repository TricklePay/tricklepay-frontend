# End-to-end tests

`npm run test:e2e` — Playwright drives the real UI in a real browser against a
faked wallet and a faked chain.

## What is real

- The Next.js app, built and served by `npm run dev`. Routing, rendering,
  provider wiring, form validation, and state updates are the production code.
- `lib/contract.ts` in full: the transaction is really built by the Stellar SDK,
  really simulated, really assembled with the returned footprint, really
  serialised to XDR, and really re-parsed after signing. The fixtures had to be
  made valid enough for the SDK's own parsers to accept, which is most of why
  they look the way they do.
- The wallet handshake, over the same `postMessage` protocol the Freighter
  extension uses.

## What is faked

- **The extension.** `@stellar/freighter-api` doesn't expose an injectable
  `window.freighter` object; it posts `FREIGHTER_EXTERNAL_MSG_REQUEST` messages
  and waits for a matching response from the extension's content script. So the
  seam is that protocol. `fixtures/freighter.ts` answers as an unlocked,
  already-authorised wallet.
- **Signing.** The stub returns the unsigned XDR back unchanged. Nothing in the
  path under test verifies a signature, so a real one would prove nothing extra.
- **The chain.** `fixtures/chain.ts` serves Soroban JSON-RPC through
  `page.route`: account lookup, simulation, submission, confirmation.
- **The backend.** The read API is served from an in-memory `StreamStore` the
  test mutates between navigations to represent what the indexer would report
  after a transaction lands.

## What these tests therefore prove, and don't

They prove the **frontend's** happy path: that the UI collects the right input,
builds a well-formed transaction the SDK accepts, routes it through the wallet,
submits it, waits for confirmation, and reflects the result.

They also cover the draft lifecycle across a reload: a draft written to storage
is restored into the form after the page is reloaded, and the draft is cleared once
a submission succeeds. That spans a navigation and a reload, which is exactly
what a unit test cannot exercise.

They do **not** prove anything about the contract. The fake chain accepts every
transaction and reports success; it never executes the contract, checks
authorisation, moves a balance, or enforces a single invariant. A contract bug,
a wrong argument order, or a mis-encoded value would still pass here as long as
it decodes. Vesting maths is covered separately, as unit tests, in
`lib/vesting.test.ts`.

## Spec files

Each spec file owns one slice of the UI. Use this table to decide where a new
scenario belongs and which fixtures it needs.

| Spec | What it covers | Fixtures it relies on |
| --- | --- | --- |
| `cancel-confirm.spec.ts` | The two-step cancel confirmation on the stream detail page: dismissing keeps the stream and sends nothing; confirming submits exactly once and links to the transaction. | chain, freighter |
| `cancel-stream.spec.ts` | A sender cancelling end to end: the vested balance stays withdrawable for the recipient, the unvested balance returns to the sender, and the dashboard shows the stream as cancelled. | chain, freighter |
| `copy-button.spec.ts` | The "Copy From" button writes the sender address to the clipboard and shows a temporary "Copied" confirmation. | chain (`stubApi`, `streamingStream`); browser clipboard permission |
| `create-form-validation.spec.ts` | Empty-submit messages, clearing a field error after a valid edit, the 7-decimal amount rule, end-before-start, and the review step opening once every field is valid. | chain, freighter |
| `create-withdraw.spec.ts` | The create-to-withdraw happy path through review, signing, submission, confirmation, the success notice, a reload, and withdrawal, including Stellar Expert links. | chain, freighter |
| `native-xlm.spec.ts` | The "Use native XLM" shortcut fills the token field with the configured native asset contract id. The review-label assertion is currently marked `test.fixme` pending a native-asset label bug. | chain, freighter |
| `shared-wallet-state.spec.ts` | Disconnecting in the header clears the dashboard and detail-page actions, and the wallet is probed once per page load rather than once per consumer. | chain, freighter |
| `stream-not-found.spec.ts` | An unknown stream id renders the "Stream not found" heading, names the id, and offers a link back to the dashboard. | chain (`stubApi`) |
| `streams-pagination.spec.ts` | The dashboard loads 25 rows and fetches the next page on "Load more"; the API stub also verifies unknown query parameters are rejected and `total` is only returned with `includeTotal`. | chain (`stubApi`, `streamingStream`) |
| `theme-persistence.spec.ts` | Toggling the theme writes the choice to `localStorage` and the light theme survives a reload. | none |
| `timeout-recovery.spec.ts` | A transaction that stays `PENDING` for 30 polls shows the timeout alert; "Re-check status" keeps polling without re-submitting and clears the alert on success. | chain, freighter, Playwright clock |
| `visual-smoke.spec.ts` | Three page screenshots: dashboard, create form desktop, and create form mobile. See [Visual regression suite](#visual-regression-suite). | chain, freighter |
| `wrong-network.spec.ts` | A wallet on `PUBLIC` is refused before signing with a message naming both networks; the mismatch banner appears, and a wallet on the expected network is not blocked. | chain, freighter |

"chain" means `e2e/fixtures/chain.ts`, which exports `stubApi`, `stubChain`,
`streamingStream`, `TOKEN_ID`, `TX_HASH`, and the `StreamStore` type.
"freighter" means `e2e/fixtures/freighter.ts`, which exports
`installFreighterStub` and `TEST_ADDRESS`.

## Running one spec or one test

Run a single spec from the repository root with `npx playwright test`, or pass
the path through the npm script:

```bash
npx playwright test e2e/cancel-stream.spec.ts
npm run test:e2e -- e2e/cancel-stream.spec.ts
```

Narrow further to one test by title with `-g`:

```bash
npx playwright test e2e/cancel-stream.spec.ts -g "cancels through the UI"
```

Playwright starts the dev server on port 3100 using the stub-friendly
environment in `playwright.config.ts`. The visual spec is just another file:

```bash
npx playwright test e2e/visual-smoke.spec.ts
```

## Visual regression suite

The visual suite is a smoke test, not a full visual coverage suite. It is one
file, `visual-smoke.spec.ts`, and captures exactly three page screenshots:
the dashboard at the desktop default viewport, the create form at the same
desktop viewport, and the create form at 375 × 667. Each capture allows a 5%
pixel difference and masks nothing. The wallet, backend, and chain are the same
fakes the functional specs use.

It deliberately does **not** cover landing, auth, modals, individual components
and their states, light theme, or other breakpoints. Functional correctness
belongs to the other specs and the unit tests.

The full description — including baseline locations, regeneration commands, and
how to review a diff — is in
[docs/visual-regression.md](../docs/visual-regression.md).

## Notes for anyone extending these

- Both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_RPC_URL` point at hosts that are
  unreachable on purpose. Everything is fulfilled by `page.route`, so a request
  that escapes the stubs fails loudly instead of quietly reaching a real
  network.
- Freighter's client matches responses on `messagedId` — its typo, not ours.
  Replying with `messageId` leaves every request hanging until it times out.
- A successful `getTransaction` is parsed in full by the SDK — envelope, result,
  and meta all decode before the app ever reads `status` — so those fields have
  to be genuine XDR rather than placeholder strings.
