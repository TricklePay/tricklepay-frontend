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

See [Running locally](#running-locally) for detailed setup instructions,
[Configuration](#configuration) for environment variables, and
[Wallet Requirement](#wallet-requirement) for the Freighter wallet walkthrough.

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

Requires Node 20+, the [Freighter](https://www.freighter.app) extension, and a
running backend.

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_CONTRACT_ID and the API URL
npm install
npm run dev
```

Open http://localhost:3000.

## Configuration

Configuration comes from `NEXT_PUBLIC_*` variables; see `.env.example`.

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL of the backend read API. |
| `NEXT_PUBLIC_NETWORK` | `testnet` or `mainnet`. |
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint. Defaults to the network's public endpoint. |
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed stream contract id. |

## API contract

The frontend integrates with two independent backends — the read-only
tricklepay-backend REST API (`lib/api.ts`) and the Soroban stream contract,
invoked directly (`lib/contract.ts`). Request/response shapes, amount and
time encoding, the write transaction lifecycle, and the on-chain error-code
mapping are all documented in [docs/api-contract.md](docs/api-contract.md).

## Project structure

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

## Related repositories

- **tricklepay-contracts** — the Soroban streaming contract.
- **tricklepay-backend** — indexer and read API this client consumes.
- **tricklepay-docs** — architecture, security model, and contributor guides.

## License

MIT. See [LICENSE](LICENSE).
