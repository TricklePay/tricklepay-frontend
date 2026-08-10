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

They do **not** prove anything about the contract. The fake chain accepts every
transaction and reports success; it never executes the contract, checks
authorisation, moves a balance, or enforces a single invariant. A contract bug,
a wrong argument order, or a mis-encoded value would still pass here as long as
it decodes. Vesting maths is covered separately, as unit tests, in
`lib/vesting.test.ts`.

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
