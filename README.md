# TricklePay Frontend

Web client for TricklePay token streams on Stellar.

Connect a Freighter wallet to see your incoming and outgoing streams, watch a
recipient's balance accrue in real time, and create, withdraw from, or cancel a
stream — all signed in the wallet and confirmed on-chain.

It reads stream data from [tricklepay-backend](#related-repositories) and writes
to the stream contract directly over Soroban RPC.

## Quickstart

```bash
git clone https://github.com/TricklePay/tricklepay-frontend.git
cd tricklepay-frontend
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your
[Freighter](https://www.freighter.app) wallet on testnet.

New to the project? [docs/local-setup.md](docs/local-setup.md) is the
start-to-finish local environment guide — prerequisites, every variable and
where its value comes from, the frontend/backend port clash, how to verify the
setup, and what the common first-run errors mean.

See also [Running locally](#running-locally) for the short version,
[Configuration](#configuration) for environment variables, and
[Wallet Requirement](#wallet-requirement) for the Freighter wallet walkthrough.

## Table of Contents

- [Quickstart](#quickstart)
- [Features](#features)
- [Stack](#stack)
- [Browser Support](#browser-support)
- [Wallet Requirement](#wallet-requirement)
- [Running locally](#running-locally)
- [Testing](#testing)
  - [Running unit tests (Vitest)](#running-unit-tests-vitest)
  - [Running end-to-end tests (Playwright)](#running-end-to-end-tests-playwright)
  - [Full local setup guide](docs/local-setup.md)
- [Configuration](#configuration)
  - [Switching Contracts](#switching-contracts)
- [Troubleshooting](#troubleshooting)
- [Glossary of Streaming Terms](#glossary-of-streaming-terms)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Styling Approach](#styling-approach)
  - [Colours and Palette](#colours-and-palette)
  - [Spacing and Layout](#spacing-and-layout)
  - [Dark and Light Themes](#dark-and-light-themes)
- [Project structure](#project-structure)
  - [Folder Structure and Conventions](#folder-structure-and-conventions)
  - [Module Map](#module-map)
- [API contract](#api-contract)
- [Related repositories](#related-repositories)
- [License](#license)

## Features

- **Wallet connect** via Freighter, with silent session restore and a
  network-mismatch warning.
- **Dashboard** splitting streams into incoming (you receive) and outgoing
  (you send).
- **Live balances** — a streaming stream's withdrawable amount is recomputed
  every second client-side, using the same linear vesting math as the contract,
  so it climbs in real time without polling.
- **Create** a stream with a recipient, token, amount, time window, and optional
  cliff.
- **Withdraw** as the recipient and **cancel** as the sender, each built, signed,
  submitted, and confirmed on-chain with step-by-step transaction progress stages (Preparing -> Sign -> Submit -> Confirm).
- **Duplicate submission protection** — in-flight invocation guards in contract utilities and components prevent double-submitting active transactions.
- **Transaction timeout recovery** — explicit recovery UI allows re-checking confirmation by transaction hash if network confirmation times out without re-submitting.
- **Maximum withdraw amount hint** — accessible hint and quick "Max" action fill the withdrawal input directly with the live vested balance.
- **Keyboard focus visibility** — every interactive element gets a consistent, high-contrast focus ring when navigated to via keyboard (`:focus-visible` in `app/globals.css`), independent of any per-component focus styling.
- **Reduced-motion support** — visitors with the OS-level "reduce motion" preference enabled get all animations and transitions (skeleton shimmer, spinners, progress pulses, hover/focus transitions) collapsed to a single frame, app-wide (`prefers-reduced-motion` in `app/globals.css`).
- **Light theme toggle** — a header button flips the whole app between dark (default) and light, persisted in `localStorage` and applied before first paint to avoid a flash of the wrong theme. See `components/theme-toggle.tsx`, `components/theme-provider.tsx`, and `lib/theme.ts`.
- **Branded loading indicator** — indeterminate loading states (route transitions, wallet connect) use `components/brand-spinner.tsx`, three bouncing indigo dots echoing the trickle-drop mark in `app/icon.svg`, instead of a generic spinner. Content-shaped loading (stream lists, stream detail) keeps the existing skeletons in `components/skeleton.tsx`.

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [@stellar/stellar-sdk](https://github.com/stellar/js-stellar-sdk) for the write path
## Browser Support

TricklePay is designed for modern desktop browsers with the [Freighter](https://www.freighter.app) wallet extension installed:
- **Google Chrome** (version 100+)
- **Brave Browser**
- **Mozilla Firefox** (version 100+)
- **Microsoft Edge** (Chromium-based)

Mobile browsers and browsers without extension support can view public stream information but require a supported desktop browser to sign and execute transactions.

## Wallet Requirement

TricklePay requires the [Freighter](https://www.freighter.app) browser extension to sign and submit transactions.

### Installing Freighter

1. Visit [freighter.app](https://www.freighter.app) and install the extension for your browser.
2. Create a new wallet or import an existing Stellar keypair.
3. Open the extension and switch the network to **Testnet** (via the network dropdown in the extension's top bar).

### Network Mismatch

If your Freighter wallet is on a different network than what the app expects (e.g. the wallet is on `PUBLIC` while the app is configured for `testnet`), the client displays a warning banner and disables stream creation and management actions. Switch the wallet's network to match the app's `NEXT_PUBLIC_NETWORK` setting.

### Funded Account

A funded account is required to create a stream. Fund your testnet account using the [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=testnet) or the Friendbot faucet.

## Running locally

### Prerequisites

- **Node.js**: `v20.0.0` or higher (Node 20+ LTS). Next.js 15, React 19, and Tailwind CSS v4 build tooling require Node 20+ runtime features and module resolution; older Node versions will encounter errors during package installation or compilation.
- **npm**: `v10.0.0` or higher.
- **.nvmrc**: If you use nvm, run `nvm use` to switch to the pinned Node 20 runtime before installing dependencies.
- **Freighter Extension**: Installed in your browser (see [Wallet Requirement](#wallet-requirement)).
- **Backend API**: A running instance of `tricklepay-backend`.

### Setup

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_CONTRACT_ID and the API URL
nvm use                      # optional: use the Node version pinned in .nvmrc
npm install
npm run dev
```

Open http://localhost:3000.

## Testing

### Running unit tests (Vitest)

Unit tests cover the pure modules in `lib/` and component flows, run with
[Vitest](https://vitest.dev/):

```bash
npm test
```

To run a single test file, pass its path to `vitest run`:

```bash
npx vitest run lib/vesting.test.ts
```

To run one test by name, add the `-t` flag with a pattern matching the test
title:

```bash
npx vitest run lib/vesting.test.ts -t "vests the full amount at and after the end"
```

The pattern is a regular expression matched against full test names, so a
substring like `-t "cliff"` works too. See [Testing
Strategy](CONTRIBUTING.md#-testing-strategy) in the contribution guide for what
each suite covers.

### Running end-to-end tests (Playwright)

The end-to-end suite drives the real UI in a real browser against faked chain
and wallet fixtures:

```bash
npm run test:e2e
```

The chain and wallet are **stubbed by fixtures**, not real: `e2e/fixtures/chain.ts`
intercepts every Soroban RPC and backend API request with `page.route`, and
`e2e/fixtures/freighter.ts` answers the extension's `postMessage` handshake as
an unlocked, already-authorised wallet. Nothing touches a real network, so the
suite needs no funded account or deployed contract.

On first run, install the Playwright browsers:

```bash
npx playwright install chromium
```

See [End-to-end tests](e2e/README.md) for exactly what the suite proves — and
what it deliberately does not.
> [!NOTE]
> `tricklepay-backend` also defaults to port 3000. Run one of them elsewhere —
> `npm run dev -- --port 3001` moves the frontend and leaves
> `NEXT_PUBLIC_API_URL` at its default.

`NEXT_PUBLIC_CONTRACT_ID` is validated as the app boots, so a missing or
malformed value stops it with a configuration error instead of failing at the
first transaction.

### Full local setup guide

[docs/local-setup.md](docs/local-setup.md) covers the whole path in detail:

- prerequisites and how to check them,
- `.env.local` vs `.env`, and why `NEXT_PUBLIC_*` edits need a restart,
- what every variable means and where to obtain its value,
- choosing ports for the frontend and backend,
- installing, funding, and network-matching Freighter,
- a step-by-step way to verify the setup works,
- the errors a first run tends to produce, and what each one means,
- the full command reference, including the Playwright browser download.

## Configuration

Configuration comes from `NEXT_PUBLIC_*` variables; see `.env.example`, and
[docs/local-setup.md](docs/local-setup.md#4-fill-in-each-variable) for where
each value comes from.

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed stream contract ID (starts with `C`). | Yes | *(None)* |
| `NEXT_PUBLIC_API_URL` | Base URL of the backend read API. | No | `http://localhost:3000` |
| `NEXT_PUBLIC_NETWORK` | Stellar network (`testnet` or `mainnet`). | No | `testnet` |
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint for submitting transactions. | No | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | Milliseconds a backend read may take before it is aborted. `0` disables the timeout. | No | `10000` |

### Switching Contracts

To switch the application to interact with a different stream contract:

1. Update `NEXT_PUBLIC_CONTRACT_ID` in `.env.local` (or your environment variable configuration) with the new contract address.
2. Rebuild the application (`npm run build`) or restart the development server so that the change is compiled into the JavaScript bundle.

> [!IMPORTANT]
> **Rebuild Required:** Next.js inlines `NEXT_PUBLIC_*` environment variables directly into the client-side JavaScript bundle at build/compile time. Because the contract ID is fixed at build time, simply modifying `.env.local` and restarting a running production instance without rebuilding will not update the active contract ID, causing the app to continue targeting the old contract.

## Troubleshooting

Common local setup issues and their resolutions. For first-run problems
specifically, see
[docs/local-setup.md](docs/local-setup.md#9-common-setup-failures), which also
covers port clashes, contract-id validation errors, and Node version failures.

### Wallet Network Mismatch
- **What you see:** A warning banner appears stating *"Wallet Network Mismatch: Connected to PUBLIC, but app expects testnet"*, and stream creation/management buttons are disabled.
- **Fix:** Open the Freighter extension in your browser, click the network selector at the top, and switch to **Testnet** (or the network specified by `NEXT_PUBLIC_NETWORK`).

### Backend API Not Running or Unreachable
- **What you see:** Dashboard stream lists fail to load, showing error messages or infinite loading skeletons, and the browser console logs `ERR_CONNECTION_REFUSED` or `Failed to fetch` requests against `NEXT_PUBLIC_API_URL`.
- **Fix:** Start the `tricklepay-backend` service locally, or check `.env.local` to verify `NEXT_PUBLIC_API_URL` points to the correct backend host.

### Backend Requests Timing Out
- **What you see:** Stream lists and detail pages fail with *"Timed out loading the stream list after 10s"* after a pause, rather than loading.
- **Fix:** The backend is unreachable or slower than the request budget. Check it is running and reachable at `NEXT_PUBLIC_API_URL`; if it is simply slow (a cold start, a distant host), raise `NEXT_PUBLIC_API_TIMEOUT_MS` — e.g. `NEXT_PUBLIC_API_TIMEOUT_MS=30000` — and restart the dev server so the new value is compiled in.

### Stale Build Serving Old Contract ID
- **What you see:** Transactions continue targeting a previously configured contract address even after updating `NEXT_PUBLIC_CONTRACT_ID` in `.env.local`, or transaction submissions fail with `HostError` / invalid contract invocation errors.
- **Fix:** Because `NEXT_PUBLIC_*` values are inlined at build time, stop the application server and run `npm run build` (or restart `npm run dev`) to recompile the client bundle with the updated contract ID.

## Glossary of Streaming Terms

TricklePay uses precise terminology across the interface to represent continuous token streaming schedules and balances. Each definition below directly matches how the value is computed across the smart contract, backend indexer, and frontend client:

- **Vested (`vested`)**: The cumulative total of tokens that have unlocked along the stream's linear schedule from `startTime` up to the current timestamp (`now`).
  - *Computation:* Evaluated in base units (stroops) matching `lib/vesting.ts` and the Soroban contract:
    - If `now < cliffTime` or `now < startTime`: `0`.
    - If `now >= endTime`: `totalAmount`.
    - Otherwise: `(totalAmount * (now - startTime)) / (endTime - startTime)`.
- **Withdrawn (`withdrawn`)**: The cumulative total of tokens that the recipient has already transferred out of the stream contract through on-chain `withdraw` or `withdraw_amount` transactions.
- **Withdrawable (`withdrawable`)**: The portion of the vested balance that the recipient is eligible to claim immediately.
  - *Computation:* `max(0, vested - withdrawn)`.
- **Locked (`locked`)**: The unvested portion of the total stream amount that remains locked in the contract awaiting future release.
  - *Computation:* `totalAmount - vested`. For active streams (`streaming` or `pending`), this represents tokens awaiting future vesting. When a stream is `cancelled`, the unvested balance is returned to the sender.
- **Cliff (`cliffTime`)**: An optional initial milestone timestamp before which zero tokens vest (`vested = 0`). Once `now >= cliffTime`, the stream immediately unlocks the full linear allocation accrued since `startTime`. When no cliff is configured, `cliffTime` equals `startTime`.
- **Progress (`progress`)**: The proportion of the total stream allocation that has vested so far, expressed in basis points (`0` to `10000`, where `100 bps = 1%`).
  - *Computation:* `(vested / totalAmount) * 10000` (precomputed by the backend indexer and rendered as a percentage `value / 100` via `components/progress-bar.tsx`).
- **Status (`status`)**: The discrete lifecycle phase of a stream:
  - `pending`: The current time is before `startTime` (`now < startTime`).
  - `streaming`: The stream is actively vesting in real time (`startTime <= now < endTime` and not cancelled).
  - `completed`: The stream has reached or passed `endTime` (`now >= endTime`), and 100% of tokens have fully vested.
  - `cancelled`: The sender stopped the stream before `endTime`; unvested funds were returned to the sender while remaining vested tokens remain available for the recipient to withdraw.

## Frequently Asked Questions

### 1. Why do stream balances update in real time without refreshing the page?
Active streams calculate live balance accrual entirely client-side using `useAccrual` (`hooks/use-accrual.ts`), which evaluates the contract's integer linear vesting math once every second. This enables real-time balance climbing without polling the backend API or Soroban RPC endpoints. See [Live balances](#features) and the [Vested computation](#glossary-of-streaming-terms).

### 2. Does TricklePay custody or hold any user funds or private keys?
No. TricklePay is completely non-custodial. All tokens committed to a stream are held directly by the deployed Soroban stream smart contract on the Stellar network. All state-modifying actions (creating a stream, withdrawing tokens, cancelling a stream) are assembled locally and signed exclusively within your browser by the [Freighter extension](#wallet-requirement). The backend API is read-only and never handles private keys or transaction signing. See [Wallet Requirement](#wallet-requirement) and [On-chain contract surface](docs/api-contract.md#2-on-chain-contract-surface).

### 3. What happens to remaining unvested tokens when a stream is cancelled?
When a sender cancels an active stream, vesting stops immediately at that exact second. All tokens vested up to that point remain available for the recipient to withdraw at any time, while all remaining unvested ([locked](#glossary-of-streaming-terms)) tokens are immediately returned to the sender's account in the same transaction. See [Glossary: Locked & Status](#glossary-of-streaming-terms) and [Stream detail balance display](docs/api-contract.md#streamview-field-contract).

### 4. Why am I seeing a "Wallet Network Mismatch" warning?
This warning appears when your connected Freighter wallet is targeting a different Stellar network (such as `PUBLIC` / mainnet) than what the application expects (such as `testnet` specified by `NEXT_PUBLIC_NETWORK`). Switch the network selector in your Freighter extension to match the app configuration. See [Network Mismatch](#network-mismatch) and [Troubleshooting: Wallet Network Mismatch](#wallet-network-mismatch).

### 5. Why do environment variable changes require rebuilding the application?
Next.js inlines all `NEXT_PUBLIC_*` configuration variables directly into the static client JavaScript bundle at build time. Modifying `.env.local` without running `npm run build` (or restarting `npm run dev`) will cause the client bundle to continue targeting old contract addresses or RPC endpoints. See [Configuration: Switching Contracts](#switching-contracts) and [Troubleshooting: Stale Build](#stale-build-serving-old-contract-id).

### 6. How does the frontend prevent duplicate submissions and handle timeout errors?
The client enforces a single in-flight transaction lock in `lib/contract.ts` to prevent duplicate concurrent submissions. If network confirmation exceeds the polling threshold (30 seconds), the client raises a `TransactionTimeoutError` preserving the submitted transaction hash, allowing users to safely re-check confirmation status without risking a duplicate transaction. See [Features](#features) and [Transaction lifecycle](docs/api-contract.md#transaction-lifecycle).

## Styling Approach

TricklePay employs utility-first styling powered by [Tailwind CSS v4](https://tailwindcss.com) (`@import "tailwindcss";` in `app/globals.css`). Styling conventions focus on shared design tokens, an inverted neutral palette for instant theming, accessible contrast standards, and responsive layout guidelines.

### Colours and Palette

- **Neutral Ramp (`neutral-*`)**: The primary monochrome scale used across the application for backgrounds, cards, borders, input controls, and typography.
  - *Dark theme (default):* Backgrounds use `bg-neutral-950` and `bg-neutral-900`, borders use `border-neutral-800` and `border-neutral-700`, while text hierarchy spans `text-neutral-100` (headings/primary values), `text-neutral-300` / `text-neutral-400` (body/secondary text), and `text-neutral-500` (muted labels/hints).
- **Brand Accent (`indigo-*`)**: `var(--color-indigo-500)` serves as the primary brand accent (matching the trickle-drop mark in `app/icon.svg`). It is applied to interactive keyboard focus rings (`:focus-visible`) and branded loading spinners (`components/brand-spinner.tsx`), ensuring a compliant contrast ratio of at least 3:1 across both dark and light modes.
- **Semantic Status Colours**: Standardized status tokens maintain clear visual indicators across both light and dark themes:
  - *Streaming (Active):* Green (`text-green-300`, `bg-green-950/40`, `border-green-700/50`).
  - *Completed:* Blue (`text-blue-300`, `bg-blue-950/40`, `border-blue-700/50`).
  - *Cancelled / Destructive / Error:* Red (`text-red-300`, `text-red-400`, `bg-red-950/20`–`40`, `border-red-700/50`–`border-red-900/50`).
  - *Pending / Locked / Notice:* Amber and Neutral (`text-amber-400/80`, `bg-neutral-800`, `border-neutral-700`).

### Spacing and Layout

- **Spacing Grid**: UI spacing follows a consistent 4px rhythm using Tailwind spacing utilities (`gap-2` = 8px, `gap-3` = 12px, `gap-4` = 16px, `p-4` = 16px, `p-6` = 24px, `py-10` = 40px).
- **Container Constraints**: Content widths are bounded for readability: forms and stream detail views use `mx-auto max-w-2xl` (672px), while dashboard listings expand across responsive grid structures (`max-w-4xl`, `max-w-6xl`).
- **Touch Targets & Accessibility**: Interactive controls (buttons, inputs, links) maintain a minimum touch target size of **44px x 44px**. Keyboard navigation is globally highlighted via `:focus-visible` with high-contrast outlines (`outline: 2px solid var(--color-indigo-500)`).
- **Typography & Numbers**: Standard system sans-serif typography is paired with `font-mono` for cryptographic addresses, contract IDs, and token amounts. Numeric figures that change frequently utilize `tabular-nums` to prevent layout jitter during live balance ticks.
- **Motion & Animations**: Transitions and animations respect the OS-level `prefers-reduced-motion: reduce` preference by collapsing all durations to 0.01ms globally in `app/globals.css`.

### Dark and Light Themes

- **Inverted Neutral Token Architecture**: Dark mode is the default theme (`:root { color-scheme: dark; }`). Rather than scattering redundant `dark:*` variant classes across every element, light mode is activated by adding a `.light` class to the root `<html>` element (`:root.light`). Under `:root.light`, CSS custom properties for the neutral palette (`--color-neutral-50` through `--color-neutral-950`) are inverted in `app/globals.css` (e.g., `neutral-950` maps to `#fafafa` and `neutral-100` maps to `#171717`). All components automatically adapt without per-component overrides.
- **Zero-Flash Theme Bootstrapping**: User theme selection is stored in `localStorage` under `trickle-theme` and evaluated synchronously before first paint via an inline script in `app/layout.tsx` (using pure resolution logic in `lib/theme.ts`), preventing any flash of unstyled theme (FOUC). React components subscribe to theme changes via `ThemeProvider` (`components/theme-provider.tsx`) and `ThemeToggle` (`components/theme-toggle.tsx`).

## Project structure

### Folder Structure and Conventions

The codebase follows a modular directory organization separating route declarations, presentation, reactive hooks, domain logic, and testing:

| Directory | What Belongs Here | Example |
| --- | --- | --- |
| `app/` | Next.js App Router route segments, layouts, page entrypoints, route error boundaries, loading skeletons, and global stylesheet definitions. Files here handle routing, URL params, and top-level page composition. | `app/streams/[id]/page.tsx` |
| `components/` | Reusable React UI components, interactive widgets, form controls, status badges, and React Context providers. Code here focuses on rendering presentation, user interaction, and accessibility attributes. | `components/stream-card.tsx` |
| `hooks/` | Custom React hooks that encapsulate stateful side effects, reactive timers, browser event listeners, and context consumption without rendering JSX markup directly. | `hooks/use-accrual.ts` |
| `lib/` | Pure, framework-agnostic domain logic, Soroban SDK transaction builders, REST API client functions, validation rules, formatting helpers, and configuration constants. Code here avoids React hooks/JSX so it can be tested directly in headless unit tests. | `lib/vesting.ts` |
| `types/` | TypeScript type declarations, interfaces, and data models representing backend API schemas, contract payloads, and shared domain entities. | `types/stream.ts` |
| `e2e/` | Playwright end-to-end user journey tests, synthetic wallet listeners, mock chain fixtures, and visual regression smoke tests. | `e2e/cancel-confirm.spec.ts` |
| `docs/` | In-depth technical specifications, protocol integration guides, API contracts, and architectural documentation. | `docs/api-contract.md` |

```
app/
  layout.tsx            root layout: theme bootstrap script, providers, header
  loading.tsx           route-level branded loading fallback
  page.tsx              dashboard: incoming and outgoing streams
  create/page.tsx       create-stream form
  streams/[id]/page.tsx stream detail with live balance and actions
components/
  header.tsx            brand, nav, theme toggle, wallet button
  theme-provider.tsx    app-wide light/dark theme state via context
  theme-toggle.tsx      header button that flips the theme
  brand-spinner.tsx     branded loading indicator (bouncing dots)
  wallet-provider.tsx   app-wide Freighter connection state via context
  wallet-button.tsx     connect / address / network state
  stream-card.tsx       stream summary card
  stream-list.tsx       grid of cards with an empty state
  create-form.tsx       new-stream form
  stream-actions.tsx    withdraw and cancel buttons
  transaction-progress.tsx transaction progress stage indicator
hooks/
  use-accrual.ts        per-second vested/withdrawable recomputation
lib/
  config.ts             client configuration
  api.ts                backend API client
  contract.ts           build, sign, submit, confirm contract calls with stage tracking
  vesting.ts            linear vesting math, mirroring the contract
  format.ts             amount and address formatting
  theme.ts              pure light/dark theme resolution logic
types/
  stream.ts             API response types
```

### Module Map

| Directory | Purpose |
| --- | --- |
| `app/` | Next.js App Router pages, layouts, and route-level loading states |
| `components/` | Reusable React UI components and context providers |
| `hooks/` | Custom React hooks (e.g. live balance accrual) |
| `lib/` | Core domain logic, SDK helpers, and configuration |
| `types/` | TypeScript type definitions for API responses |
| `e2e/` | Playwright end-to-end and visual regression tests |
| `docs/` | Architecture and API contract documentation |

## API contract

The frontend integrates with two independent backends — the read-only
tricklepay-backend REST API (`lib/api.ts`) and the Soroban stream contract,
invoked directly (`lib/contract.ts`). Request/response shapes, amount and
time encoding, the write transaction lifecycle, and the on-chain error-code
mapping are all documented in [docs/api-contract.md](docs/api-contract.md).

## Related repositories

- **tricklepay-contracts** — the Soroban streaming contract.
- **tricklepay-backend** — indexer and read API this client consumes.
- **tricklepay-docs** — architecture, security model, and contributor guides.

## License

MIT. See [LICENSE](LICENSE).
