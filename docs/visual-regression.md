# Visual regression smoke suite

`e2e/visual-smoke.spec.ts` captures three viewport screenshots with the existing fake Freighter wallet, empty stream store, API, and Soroban RPC fixtures:

| Baseline | Viewport | View |
| --- | --- | --- |
| `dashboard-smoke-chromium-linux.png` | 1280 × 720 | Connected wallet dashboard with no streams |
| `create-stream-smoke-chromium-linux.png` | 1280 × 720 | Empty create-stream form |
| `create-stream-mobile-smoke-chromium-linux.png` | 375 × 667 | The same form at mobile width |

The tracked images live in `e2e/visual-smoke.spec.ts-snapshots/`. These are viewport captures, so content below the viewport is intentionally excluded. They do not cover stream detail, validation errors, or every theme and breakpoint.

## Baseline environment

The baselines are captured on the **Ubuntu Linux x64 runner used by CI** with **Node.js 22**, the locked **Playwright 1.62.1**, and Chromium installed by `npx playwright install --with-deps chromium`. The app runs through the Next.js development server configured in `playwright.config.ts`.

The spec fixes the browser locale to `en-US`, time zone to `UTC`, color scheme to `light`, and clock to `2026-01-01T12:00:00Z`. It waits for the wallet and API to settle and hides the Next.js development overlay in screenshots. Storage is fresh for each test. No real wallet, backend, or chain is needed.

Playwright includes the project and platform in snapshot filenames. Use this Windows environment to compare these baselines; Linux and macOS render native controls and fonts differently and require separately reviewed platform images. There is currently no visual-test CI job or pinned Docker baseline.

## Run from a clean checkout

In the Linux CI environment:

```bash
npm ci
npx playwright install --with-deps chromium
CI=1 npm run test:e2e -- e2e/visual-smoke.spec.ts --project=chromium
```

`CI=1` ensures Playwright starts its own server with the fixture environment instead of reusing a server with different configuration. Keep port 3100 free and avoid local `.env` overrides, especially `NEXT_PUBLIC_MOCK_API=true`. `npm test` runs Vitest and does not execute these browser screenshots.

## Update baselines deliberately

After making an intentional UI change, use the same Linux environment:

```bash
npx playwright install --with-deps chromium
CI=1 npm run test:e2e -- e2e/visual-smoke.spec.ts --project=chromium --update-snapshots
```

Review all changed PNGs in `e2e/visual-smoke.spec.ts-snapshots/`, then run the command again without `--update-snapshots` to check the comparisons. Commit the reviewed images with the UI change. A new platform creates additional files; do not rename images from another operating system to match Windows filenames.

On a mismatch, Playwright writes actual, expected, and diff images under `test-results/`. Inspect those images before updating anything. Explain the intended visual change in the pull request; do not overwrite an unexplained diff just to silence a failure.

The initial baselines were generated directly through Playwright's screenshot API with the same fixtures and capture settings, without executing the test runner. A clean-checkout test run has not been performed for this change.
