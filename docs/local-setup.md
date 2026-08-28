# Local environment setup

A start-to-finish walkthrough for running the TricklePay frontend on your own
machine: what to install, what every environment variable means and where its
value comes from, how to check the setup actually works, and what the common
first-run failures look like.

If you only need the variable table, see
[Configuration](../README.md#configuration) in the README. If you are setting
up to contribute a change, read this first and then
[CONTRIBUTING.md](../CONTRIBUTING.md) for the branch and PR workflow.

- [1. Prerequisites](#1-prerequisites)
- [2. Clone and install](#2-clone-and-install)
- [3. Create your env file](#3-create-your-env-file)
- [4. Fill in each variable](#4-fill-in-each-variable)
- [5. Choose your ports](#5-choose-your-ports)
- [6. Set up Freighter](#6-set-up-freighter)
- [7. Run the app](#7-run-the-app)
- [8. Verify the setup](#8-verify-the-setup)
- [9. Common setup failures](#9-common-setup-failures)
- [10. Day-to-day commands](#10-day-to-day-commands)

## 1. Prerequisites

| Requirement | Version | Why |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | `>=20.0.0` (20 LTS or newer) | Next.js 15, React 19, and the Tailwind v4 build tooling rely on Node 20 runtime features and module resolution. Node 18 fails during install or compilation. |
| npm | `>=10.0.0` | Ships with Node 20. |
| Git | any recent version | Cloning the repo. |
| [Freighter](https://www.freighter.app) browser extension | latest | The only supported wallet. Needed to connect, sign, and submit — but *not* needed to browse a stream page read-only. |
| A running `tricklepay-backend` | — | Serves every list and detail view. Without it the app loads but every stream list errors. |
| A deployed stream contract id | — | Required at startup; the app refuses to boot without one (see below). |

Check your versions:

```bash
node --version   # v20.x or newer
npm --version    # 10.x or newer
```

The backend and contract are the two pieces that come from outside this repo.
Everything else is self-contained.

## 2. Clone and install

```bash
git clone https://github.com/TricklePay/tricklepay-frontend.git
cd tricklepay-frontend
npm install
```

`npm install` also installs the Playwright test runner, but not its browser
binaries — those are a separate download, only needed if you plan to run the
end-to-end suite (see [§10](#10-day-to-day-commands)).

## 3. Create your env file

```bash
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local`.

**Which filename?** Next.js loads `.env.local` in preference to `.env`, and
both are ignored by `.gitignore`, so either keeps your values out of Git.
Prefer `.env.local` for machine-specific values — if you also keep a shared
`.env`, `.env.local` wins on any key the two have in common, which is exactly
the override you want.

> [!IMPORTANT]
> `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, not
> read at runtime. **Editing the env file while the dev server is running has no
> effect until you restart it** (`Ctrl+C`, then `npm run dev` again), and a
> production deployment needs a full `npm run build`, not just a restart.

## 4. Fill in each variable

| Variable | Required | Default | Where the value comes from |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CONTRACT_ID` | **Yes** | none | The deployed stream contract. A 56-character Stellar contract address starting with `C` — from your own deploy of `tricklepay-contracts`, or from whoever runs the shared testnet deployment. |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3000` | Base URL of your running `tricklepay-backend`. |
| `NEXT_PUBLIC_NETWORK` | No | `testnet` | `testnet` or `mainnet`. Keep it on `testnet` for development — it must match the network selected in Freighter. |
| `NEXT_PUBLIC_RPC_URL` | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint used to submit signed transactions. The public endpoint is fine; override it only if you run your own node or hit rate limits. |

A filled-in `.env.local` for typical local work:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CONTRACT_ID=CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE
```

**The contract id is validated at startup.** `lib/config.ts` checks it as the
module loads, so a missing or malformed value stops the app immediately with a
plain-language error rather than surfacing as an opaque SDK failure at the
first transaction:

```
Configuration error: NEXT_PUBLIC_CONTRACT_ID is not set. Add it to your .env file (it starts with C).
```

The network passphrase is derived from `NEXT_PUBLIC_NETWORK` and is not
configurable on its own — there is no variable to set for it.

## 5. Choose your ports

`next dev` listens on **3000**, and `tricklepay-backend` also defaults to
**3000**. Running both with their defaults means one of them fails to bind, so
pick one of these:

```bash
# Option A — backend keeps 3000, frontend moves (nothing to change in .env.local)
npm run dev -- --port 3001     # then open http://localhost:3001
```

```bash
# Option B — frontend keeps 3000, backend moves
# .env.local:
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Option A is the smaller change: `NEXT_PUBLIC_API_URL` already defaults to
`http://localhost:3000`, so the frontend finds the backend with no config at
all. Whichever you choose, the two ports must differ and `NEXT_PUBLIC_API_URL`
must name the backend's.

The Playwright end-to-end suite is unaffected — it starts its own dev server on
**3100** with its own env values and stubs the network, so it neither needs nor
touches your backend.

## 6. Set up Freighter

1. Install the extension from [freighter.app](https://www.freighter.app).
2. Create or import an account.
3. Switch the network selector to **Test Net** — it must match
   `NEXT_PUBLIC_NETWORK`. A mismatch is caught before signing and shown as a
   banner; the app refuses to build a transaction that would fail in the wallet
   anyway.
4. Fund the account. A brand-new testnet account holds nothing, and creating a
   stream costs both fees and the streamed tokens. Use the
   [Stellar Laboratory account creator](https://laboratory.stellar.org/#account-creator?network=testnet)
   or Friendbot.

Browsing and reading streams works without any of this; only signing does not.

## 7. Run the app

```bash
npm run dev
```

Open the URL the terminal prints (http://localhost:3000, or 3001 if you moved
it) and click **Connect wallet**.

## 8. Verify the setup

Work down this list — each step isolates a different piece, so the first one
that fails tells you where the problem is.

```bash
npm run typecheck   # TypeScript compiles
npm run lint        # ESLint passes
npm run test        # Vitest unit suite passes
```

These three need no backend, no wallet, and no env file: the unit suite injects
its own `NEXT_PUBLIC_CONTRACT_ID` (see `vitest.config.mts`), which is why it
passes even before you have a real contract id.

Then, in the browser:

1. **The page renders** rather than showing a configuration error →
   `NEXT_PUBLIC_CONTRACT_ID` is set and well-formed.
2. **A stream list loads** (even an empty "No streams yet.") without an error
   banner → `NEXT_PUBLIC_API_URL` points at a reachable backend.
3. **Connect wallet succeeds** and shows your address → Freighter is installed
   and unlocked.
4. **No network-mismatch banner** → Freighter's network matches
   `NEXT_PUBLIC_NETWORK`.
5. **Create stream** reaches the signing prompt → the contract id and RPC
   endpoint are usable.

## 9. Common setup failures

### `Configuration error: NEXT_PUBLIC_CONTRACT_ID is not set`

The env file is missing, is named something Next.js does not load, or the key
is empty. Confirm the file is `.env.local` (or `.env`) in the repository root,
then restart the dev server — this value is read at build time, so a running
server will not pick it up.

### `... is not a valid Stellar contract address`

The value is present but malformed. A contract address is 56 characters and
starts with `C`; a `G...` account address or a truncated paste both trigger
this. Copy the id again from your deploy output.

### `EADDRINUSE: address already in use :::3000`

Something else — most often `tricklepay-backend` — already holds the port. See
[§5](#5-choose-your-ports).

### Stream lists error, console shows `ERR_CONNECTION_REFUSED` / `Failed to fetch`

The backend is not running, or `NEXT_PUBLIC_API_URL` points somewhere else.
Start the backend and confirm the URL, including the port and the absence of a
trailing path.

### "Wallet Network Mismatch" banner, actions disabled

Freighter is on a different network from `NEXT_PUBLIC_NETWORK`. Switch the
extension to Test Net, or change the variable and restart the server.

### An env change seems to have no effect

`NEXT_PUBLIC_*` values are compiled into the bundle. Restart `npm run dev`; for
a built app, re-run `npm run build`. A stale build serving an old contract id
shows up as transactions hitting the wrong contract.

### `npm install` fails with an engine or syntax error

Check `node --version`. Node 18 and older cannot build this project.

## 10. Day-to-day commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload. Add `-- --port 3001` to move it. |
| `npm run build` | Production build — the only way to pick up changed `NEXT_PUBLIC_*` values for `npm start`. |
| `npm start` | Serves the production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test` | Vitest unit suite (`lib/`, `components/`), one pass. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:e2e` | Playwright end-to-end suite. Run `npx playwright install chromium` once first; it starts its own dev server on port 3100 and stubs all network traffic, so no backend or wallet is needed. |

## Related documentation

- [README — Configuration](../README.md#configuration) — the variable table on
  its own.
- [README — Troubleshooting](../README.md#troubleshooting) — runtime issues
  beyond first-run setup.
- [docs/api-contract.md](api-contract.md) — what the backend and contract
  surfaces are expected to return.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — coding standards, testing strategy,
  and the pull request process.
