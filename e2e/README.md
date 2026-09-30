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

## Visual regression suite

The visual suite is a smoke test, not a full visual coverage suite. It captures
a small set of representative screens so that an unintentional layout or styling
regression is caught in CI before it ships.

### What it covers

The snapshots are taken from the same Playwright browser against the same faked
wallet and chain as the functional e2e tests. Each snapshot covers a key state
of the app:

- **Stream list / empty state** — the landing view with no streams, including
  the empty-state copy and layout.
- **Stream detail** — the vesting progress, balances, and action controls for a
  seeded stream.
- **Create stream form** — the form in its default and validation-error states.
- **Wallet connected vs. disconnected** — the differences in the header and
  available actions.

The suite deliberately does **not** attempt to cover every component, every breakpoint,
or every interaction. The functional e2e tests and unit tests are responsible for
correctness. The visual suite is responsible for catching unintentional visual
changes to those screens.

### Running the suite

```bash
npm run test:e2e -- visual
```

The first run on a new machine may report diffs because of font rendering,
sub-pixel anti-aliasing, or a different browser build. Snapshots are committed
and expected to be generated in the same environment as CI (the pinned
Playwright image). If local diffs appear on a machine that is not the CI image,
 re-run in the pinned container before concluding there is a regression.

### Updating a snapshot deliberately

A snapshot should only be updated when the visual change is itself the
intented change. To update it:

1. Make the code change that alters the UI.
2. Run the suite and inspect the reported diff (Playwright writes a
   `*-diff.png` and an HTML report under `test-results/`).
3. Confirm the diff matches the intended change and nothing else.
4. Update the snapshot explicitly:

   ```bash
   npm run test:e2e -- visual --update-snapshots
   ```

5. Re-run the suite without `--update-snapshots` to confirm it passes.
6. Commit the updated snapshot files alongside the code change that caused them,
   with a commit message that explains the visual change.

### Reviewing a visual diff

When a pull request includes changed snapshots, review the images, not just the
code:

-1 Open the changed `*.png files in the GitHub files view. GitHub renders
  image diffs for committed snapshots.
-2 Check that every changed pixel belongs to the described feature or fix.
-3 If the diff is unexplained or touches unrelated screens, request changes and
   ask for the snapshot to be reverted.
-4 Run the suite locally on the branch if the rendered diff is ambiguous.

### Warning: do not update snapshots to silence a failure

Never run `--update-snapshots` just to make a failing suite green. A failing
snapshot is a signal: either the code changed the UI in a way you did not intend,
or the snapshot was written in a different environment. Blindly accepting the
new image deletes the only evidence that something broke, and the regression will
ship. If you cannot explain why the image changed, treat the failure as a bug in
the code or in the test environment, fix that cause, and only then re-generate
the snapshot.

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
