# Contributing to TricklePay Frontend

Thank you for your interest in contributing to **TricklePay**! This guide outlines our development workflow, coding conventions, testing patterns, and pull request guidelines to help you get started quickly.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📖 Table of Contents

- [Project Overview & Technology Stack](#--project-overview--technology-stack)
- [Getting Started](#--getting-started)
- [Project Structure](#--project-structure)
- [Development Guidelines & Coding Standards](#--development-guidelines--coding-standards)
- [State Management & Wallet Handoff](#--state-management--wallet-handoff)
- [Accessibility & UI Principles](#--accessibility--ui-principles)
- [User-Facing Copy](#-user-facing-copy)
- [Testing Strategy](#--testing-strategy)
- [Submitting a Pull Request](#--submitting-a-pull-request)

---

## 🛠 Project Overview & Technology Stack

TricklePay is a real-time, continuous token payment and streaming protocol built on Stellar and Soroban. The frontend repository is built with:

- &**Framework**: [Next.js 15](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- &*Stellar SDKs**: `@stellar/stellar-sdk` and `@stellar/freighter-api`
- **Unit Testing**: [Vitest](https://vitest.dev/)
- **End-to-End Testing & Visual Regression**: [Playwright](https://playwright.dev/)

---

## 🚀 **Getting Started

### Prerequisites

- &*Node.js**: `v20.0.0` or higher. The repo includes an `.nvmrc` — run `nvm use` to switch to the pinned version automatically if you use [nvm](https://github.com/nvm-sh/nvm).
- **npm**: `v10.0.0` or higher
- **Freighter Wallet Extension**: Installed in your browser (for manual development testing)

### Installation & Environment Setup

> For the full walkthrough — prerequisites, what each variable means, the
> frontend/backend port clash, verification steps, and first-run errors — see
> [docs/local-setup.md](docs/local-setup.md). The short version follows.

1. **Fork & Clone the Repository**:
   ```bash
   git clone https://github.com/<your-username>/tricklepay-frontend.git
   cd tricklepay-frontend
   git remote add upstream https://github.com/TricklePay/tricklepay-frontend.git
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Configure your local variables in `.env`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXT_PUBLIC_NETWORK=testnet
   NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
   NEXT_PUBLIC_CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser. If
   `tricklepay-backend` is already using port 3000, start the frontend on
   another one with `npm run dev -- --port 3001`.

---

## 📁 Project Structure

```text
tricklepay-frontend/
├── app/                  # Next.js App Router pages & layouts
│   ├── page.tsx          # Dashboard page
│   ├── create/           # Stream creation flow
│   └── streams/          # Detailed stream list & management
├── components/           # React UI components & providers
│   ├── wallet-provider.tsx # Single-source wallet state & context provider
│   ├── create-form.tsx   # Stream creation flow (behaviour in hooks/use-create-stream-form.ts)
│   └── stream-actions.tsx# Withdraw and cancel actions (behaviour in hooks/use-stream-actions.ts)
├── lib/                  # Core domain logic, validation, & SDK helpers
│   ├── validation.ts     # Pure form validation utilities
│   ├── contract.ts     # Soroban contract interaction & RPC submission
│   ├── amount.ts         # Token amount parsing & formatting
│   ├── format.ts         # Date, duration, and address formatting
│   ├── contract-messages.ts # Transaction lifecycle stages & status messages
│   └── stream-messages.ts   # Stream action states & blocked withdrawal reasons
├── hooks/                # Custom React hooks (e.g. useNetworkGuard)
├── e2e/                  # Playwright end-to-end and visual regression tests
└── vitest.config.mts     # Vitest unit test configuration
```

---

## 🎨 Development Guidelines & Coding Standards

1. **TypeScript Strictness**:
   - Always export interface definitions for component props and domain models.
   - Avoid using `any`; specify exact types or use `unknown` with type guards.

2. **Component Conventions**:
   - Use Client Components (`"use client"`) only when interactive state, hooks, or event listeners are required.
   - Separate business logic and pure validation utilities into `lib/` so they can be unit-tested without React rendering overhead.

3. **Form Input & Validation**:
   - All input validation rules must fail early and provide clear, human-readable error messages.
   - Focus the first invalid field upon form submission to aid keyboard users.
   - Amount inputs must strictly reject invalid decimals (> 7 decimal places, scientific notation, negatives) before performing `BigInt` conversion.

4. **Import order**:
   Imports sit at the top of the file (after any `"use client"` directive), in these groups, separated by one blank line:

   1. Node built-ins (`path`, `url`, `node:*`)
   2. External packages (`react`, `next/*`, `@stellar/*`, `vitest`, …)
   3. Internal aliases (`@/components/*`, `@/hooks/*`, `@/lib/*`, `@/types/*`)
   4. Relative paths (`../`, `./`)
   5. Stylesheets (`./globals.css`), always last

   Within a group, statements are sorted alphabetically by module path, case-insensitively. `import type` statements sort with the rest of their group; they are not split out. In tests, imports of modules that `vi.mock` replaces may follow the `vi.mock` calls, sorted the same way.

   ```ts
   import Link from "next/link";
   import { useState } from "react";

   import { useWallet } from "@/components/wallet-provider";
   import { formatAmount } from "@/lib/format";
   import type { StreamView } from "@/types/stream";

   import { Field } from "./field";
   ```

   ESLint's `import/order` rule enforces this (`eslint.config.mjs`); `npm run lint -- --fix` reorders a file for you.

---

## 🔒 State Management & Wallet Handoff

- **Wallet Session**: Managed centrally by `WalletProvider` in `components/wallet-provider.tsx`.
- **Session Auto-Restoration**: Upon mounting, `WalletProvider` probes Freighter's connection and authorization state so returning users remain signed in.
- **Network Normalization**: Freighter network labels (`TESTNET`, `PUBLIC`) are normalized to lowercase (`testnet`, `mainnet`) to match app configuration.
- &*Network Guard**: Use `useNetworkGuard()` to detect and warn users when their wallet is connected to a different network than the app expects.

---

## ♯ Accessibility & UI Principles

The commitments the project holds (skip link, focus handling, live
announcements, form labelling, reduced motion), the code that implements each,
and how to verify them are in [docs/accessibility.md](docs/accessibility.md).
Read it before changing UI, and update it in the same pull request if a change
weakens or removes a commitment. Where the list below and that document
differ, the document describes what the code does today.

- **WCAG AA Compliance**: All interactive elements must include explicit focus rings (`focus-visible:ring-2 focus-visible:ring-offset-2`).
- &*Touch Targets**: All buttons, links, and form inputs must maintain a minimum touch target size of **44px x 44px**.
- **Dark & Light Themes**: Ensure high contrast ratios across both light and dark themes (`dark:bg-neutral-900 dark:text-neutral-100`).
- &*ARIA Attributes**: Use appropriate semantic tags and ARIA labels (`role="alert"`, `aria-label`, `aria-busy`, `aria-live`).

---

## 💬 User-Facing Copy

Messages shown to users — status indicators, form validation, error banners, and action blockers — are an essential part of the product. A consistent voice matters as more contributors add them.

### Expectations for User-Facing Copy

- **Actionable & Informative**: State clearly what happened and what the user can do next. Never leave the user at a dead end without a clear next step.
- **Plain Language**: Explain contract and network events in plain English. Avoid exposing raw Soroban error tokens, internal host errors, or cryptic error codes directly to users unless as a debug footnote.
- **Accurate & Honest**: Do not state that an operation failed if the outcome is uncertain (e.g., a timeout during confirmation polling means the transaction was submitted and may still settle, not that it failed).
- **Calm & Respectful Tone**: Use sentence case and terminal punctuation. Avoid exclamation points, all-caps, or accusatory language (e.g., prefer "Recipient address is required." over "You must enter a recipient!").
- **Concise & Scannable**: Keep messages succinct and focused so they fit well in inline alerts, field hints, and toast banners across all screen sizes.

### Good vs. Poor Examples

| Context | Poor Message | Good Message | Why It's Better |
| --- | --- | --- | --- |
| **Network Mismatch** | `Error: wrong network` | `Wrong network: wallet is on testnet, app expects mainnet. Switch networks in Freighter.` | Specifies both the current and expected network, and gives an immediate, actionable resolution. |
| **Contract Error** | `Invocation trapped: Error(Contract, #7)` | `Nothing to withdraw yet — no tokens have vested since your last withdrawal.` | Translates an opaque contract error code into plain language explaining the business reason. |
| **Form Validation** | `Invalid input!` | `Must be a valid G... or C... Stellar address.` | Tells the user exactly what format is expected instead of generic failure and punctuation shouting. |
| **Confirmation Timeout** | `Transaction failed on network.` *(when polling timed out)* | `Confirmation timed out. The transaction was submitted to the network.` | Truthful about state: does not mislead the user into retrying a transaction that may already be confirming. |
| **Action Blocker** | `Withdraw button disabled.` | `Locked until the cliff on Oct 14, 2026.` | Clarifies *why* the action is unavailable and when it will unlock, rather than looking like a broken UI. |

### Where the Strings Live

To keep presentation copy easy to review and maintain, user-facing strings are kept separate from core transaction orchestration and business logic:

- **`lib/contract-messages.ts`**: Transaction lifecycle stages (`TX_STAGES`, `TX_STAGE_LABELS`), concurrency warnings (`TX_ALREADY_IN_PROGRESS_MESSAGE`), wallet rejections (`TX_SIGNING_REJECTED_MESSAGE`), network mismatch warnings (`wrongNetworkMessage`), and confirmation timeout notices (`TX_CONFIRM_TIMEOUT_MESSAGE`).
- **`lib/stream-messages.ts`**: Explanations for why stream actions are disabled or blocked (e.g., `STREAM_FULLY_WITHDRAWN_MESSAGE`, `STREAM_CANCELLED_MESSAGE`, `streamLockedUntilCliffMessage`, `streamNotStartedMessage`).
- **`lib/contract-errors.ts`**: Mapping table (`CONTRACT_ERROR_MESSAGES`) converting numeric Soroban contract error codes into plain-language messages, with a graceful generic fallback for unmapped codes.
- **`lib/create-stream-validation.ts` & `lib/validation.ts`**: Field-level validation strings and required-field messages for stream creation forms.
- **`lib/amount.ts`**: Validation error messages for token amount parsing, decimal limits, and withdrawable balance boundary checks (`withdrawalAmountError`).

> **Rule of thumb**: When adding new user-facing messages, avoid defining strings inline within transaction logic or deep component hierarchies. Define reusable messages in the corresponding `lib/*-messages.ts` module so copy and logic can be reviewed independently.

---

## 🧪 Testing Strategy

We maintain thorough unit test coverage and end-to-end visual smoke tests.

### 1. Running Unit Tests (Vitest)
Unit tests cover pure functions in `lib/` and UI component flows in `components/`:
```bash
npm test
```
To run tests in watch mode during development:
```bash
npm run test:watch
```

### 2. Typechecking
Run TypeScript type checks across the entire codebase:
```bash
npm run typecheck
```

### 3. End-to-End & Visual Regression Tests (Playwright)
Playwright owns e2e workflow validation and visual regression smoke tests:
```bash
npm run test:e2e
```

### 4. Visual Regression Suite

The Playwright visual suite is a smoke layer, not a full coverage guarantee.
It captures pixel snapshots of the key screens and states that users hit most
often, so a silent layout or styling regression is caught before merge.

**What it covers:**
- The dashboard and stream list in their default, loaded state.
- The stream creation form, including validation error messages.
- Stream detail and action controls (actions in their enabled and disabled states).
- Wallet connected vs. disconnected presentation, and the network-guard warning.
- Both light and dark themes where the screen renders them.

**What it does not cover:** animation timing, hover/focus transitions, scroll
behaviour, or third-party wallet UI. Verify those manually or with a targeted
e2e assertion.

**Updating a snapshot deliberately:**
1. Make the intentional styling or markup change first, then run the suite and
inspect the failure:
   ```bash
   npm run test:e2e
   npm run test:e2e -- --update-snapshots
   ```
2. Review the generated diff in the report and in the commited snapshot files.
Confirm every changed pixel is one you intended to make.
3. Commit the updated snapshots alongside the code change that caused them,
with a message that explains why, e.g. `feat: restyle stream card and update
snapshots`.

**Reviewing a diff:**
- Open the Playwright HTML report and compare the expected, actual, and diff
panes side by side.
- Check whether the diff is confined to the components you changed. Spread to
unrelated screens usually means a shared style, font, or layout primitive moved.
- Confirm the change is acceptable in both themes and at the captured viewport.

> **Warning:** Never run `--update-snapshots` just to make a failing suite green.
Updating a snapshot accepts the new rendering as correct. If you haven't explained
why the output changed, you're silencing a regression instead of fixing it. If the
diff is unexpected, treat it as a bug in the code and fix the code.

---

## 📩 Submitting a Pull Request

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/short-feature-description
   ```

2. **Verify All Checks Pass Before Pushing**:
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

3. **Commit Message Format**:
   Use conventional commits:
   - `feat: add wallet provider unit tests`
   - `fix: resolve form validation edge cases for token amount`
   - `docs: update frontend contribution guide`

4. **Open Pull Request**:
   - Push your branch to your fork: `git push origin feat/short-feature-description`.
   - Open a PR against `main` on the upstream repository.
   - Include issue links in your PR description: `Closes #80`, `Closes #81`, `Closes #82`, `Closes #83`.
   - You don't need to request a reviewer. [`.github/CODEOWNERS`](.github/CODEOWNERS) assigns every file to `@TricklePay/maintainers`, so GitHub requests their review when the PR opens.
