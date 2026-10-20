# Visual regression smoke suite

The visual regression suite is a small smoke test, not an exhaustive visual
coverage tool. It lives in
[`e2e/visual-smoke.spec.ts`](../e2e/visual-smoke.spec.ts) and captures three
page screenshots so that an unintended layout or styling change on the
dashboard or the create form is caught before it ships.

The functional end-to-end specs and the unit tests remain responsible for
correctness. This suite is responsible only for spotting visual changes.

## What it captures

| Screenshot | Test case | Viewport | Screen |
| --- | --- | --- | --- |
| `dashboard-smoke.png` | "dashboard page renders clean responsive layout without visual shifts" | Playwright's desktop Chromium default, 1280 × 720 | The dashboard with a connected wallet and no streams, including the header, main region, footer, and wallet status button |
| `create-stream-smoke.png` | "create stream page renders form fields and actions in desktop and mobile viewports" | 1280 × 720 | The create-stream form in its default state: recipient address, token contract id, amount, and the "Review stream" action |
| `create-stream-mobile-smoke.png` | The same test case, after `page.setViewportSize` | 375 × 667 | The same create-stream page at a mobile width |

The dashboard case also asserts that the `banner`, `main`, and `contentinfo`
landmarks are visible, and that the wallet status button renders. The create
case asserts that the three primary fields and the "Review stream" button are
visible. Those assertions run alongside each screenshot, so a missing region
fails the test even when the remaining pixels happen to match.

There is no fourth screen and no separate component gallery. The suite does
**not** cover landing pages, authentication, modals, every button, input, card,
alert, or navigation state, hover/focus/disabled/loading variants, light theme,
or breakpoints other than the two viewports above. The app has no auth flow or
modal surface to capture.

## What is stubbed

Every case runs the real Next.js UI against the same fakes used by the
functional end-to-end suite. A `beforeEach` installs:

- **The wallet.** `installFreighterStub` from `e2e/fixtures/freighter.ts`
  answers the Freighter `postMessage` protocol as an unlocked, already-authorised
  wallet on testnet, using `TEST_ADDRESS`. Signing is a pass-through; nothing in
  these screens involves a transaction.
- **The backend.** `stubApi` from `e2e/fixtures/chain.ts` serves `GET /status`,
  `GET /health`, and the stream endpoints. The visual suite seeds it with
  `{ streams: [] }`, so both dashboard lists are empty.
- **The chain.** `stubChain` from `e2e/fixtures/chain.ts` serves Soroban RPC
  account lookup, simulation, submission, and confirmation. The create form may
  use it for read-only fee and balance previews; no transaction is submitted.

Both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_RPC_URL` point at unreachable hosts.
Every request is fulfilled by these stubs, so a request that escapes them fails
loudly instead of reaching a real network.

## What is masked

Nothing is masked. The screenshots capture the visible page viewport
(Playwright's default; `fullPage` is not set) with no `mask` entries. Instead,
each screenshot allows a small tolerance:
`maxDiffPixelRatio: 0.05`, meaning up to 5% of pixels may differ before the
comparison fails. Playwright also disables animations and hides the text caret
for screenshots by default; the spec does not override those defaults.

## Running the suite

The repository has no separate `test:visual` script. Run the spec through the
normal Playwright command:

```bash
npm run test:e2e -- e2e/visual-smoke.spec.ts
```

Or directly:

```bash
npx playwright test e2e/visual-smoke.spec.ts
```

A failure means one or more screenshots differ from the committed baseline. The
expected image, actual image, and diff are written under `test-results/`, and
the HTML report can be opened with:

```bash
npx playwright show-report
```

## Where the baselines live

Playwright stores baselines next to the spec, in
`e2e/visual-smoke.spec.ts-snapshots/`, with a name that includes the project and
platform, for example `dashboard-smoke-chromium-darwin.png` or
`dashboard-smoke-chromium-linux.png`. Baselines are platform-specific because
fonts and anti-aliasing differ between operating systems; compare against
baselines generated on the same platform and browser build.

If no baseline exists for the current platform, Playwright reports a missing
snapshot and writes the actual image. Treat that first image as a proposal, not
as automatically correct.

## Regenerating a baseline deliberately

Update a baseline only when the visual change is intentional and reviewed.

1. Make the code change that alters the rendered output.
2. Run the suite without the update flag and inspect the reported diff.
3. Confirm that every difference is explained by your change.
4. Regenerate the baselines explicitly:

   ```bash
   npm run test:e2e -- e2e/visual-smoke.spec.ts --update-snapshots
   ```

   To regenerate only one capture, narrow the run by test name:

   ```bash
   npm run test:e2e -- e2e/visual-smoke.spec.ts --update-snapshots -g "dashboard"
   ```

5. Re-run the suite without `--update-snapshots` to confirm it passes against the
   new images.
6. Commit the changed files under `e2e/visual-smoke.spec.ts-snapshots/`
   alongside the code change that caused them, and explain the visual change in
   the pull request.

## Reviewing a visual diff

When a pull request includes changed screenshots:

1. Look at the committed PNGs in the GitHub files view. GitHub renders an image
   diff for each changed baseline.
2. Compare expected, actual, and the diff overlay from `test-results/` to see
   what moved, resized, recoloured, or disappeared.
3. Confirm the change is limited to the screen and area your code change
   touches. Changes on an unrelated screen usually mean a shared style, font, or
   layout primitive moved.
4. Check that the diff matches the intent of the change and is acceptable at
   both captured viewports.
5. If the difference is unexplained, request changes rather than accepting the
   new baseline.

## Do not update snapshots to silence a failure

Never run `--update-snapshots` just to make a failing test green. A failing
screenshot is evidence that the rendered output changed. Overwriting the
baseline without understanding why hides regressions and makes the suite
meaningless.

If a screenshot fails unexpectedly, investigate the cause first: look for an
unintended style, layout, dependency, font, or viewport change. Fix the code if
the change was a regression. Update the baseline only when the new output is the
intended result, and say so in the pull request.
