# Contributing to TricklePay Frontend

Thank you for your interest in contributing to **TricklePay**! This guide outlines our development workflow, coding conventions, testing patterns, and pull request guidelines to help you get started quickly.

---

## 📖 Table of Contents

- [Project Overview & Technology Stack](#-project-overview--technology-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Development Guidelines & Coding Standards](#-development-guidelines--coding-standards)
- [State Management & Wallet Handoff](#-state-management--wallet-handoff)
- [Accessibility & UI Principles](#-accessibility--ui-principles)
- [Testing Strategy](#-testing-strategy)
- [Submitting a Pull Request](#-submitting-a-pull-request)

---

## 🛠 Project Overview & Technology Stack

TricklePay is a real-time, continuous token payment and streaming protocol built on Stellar and Soroban. The frontend repository is built with:

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Stellar SDKs**: `@stellar/stellar-sdk` and `@stellar/freighter-api`
- **Unit Testing**: [Vitest](https://vitest.dev/)
- **End-to-End Testing & Visual Regression**: [Playwright](https://playwright.dev/)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.0.0` or higher
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
   NEXT_PUBLIC_CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM
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
│   ├── create-form.tsx   # Stream creation form component
│   └── stream-actions.tsx# Stream operation buttons (withdraw, pause, cancel)
├── lib/                  # Core domain logic, validation, & SDK helpers
│   ├── validation.ts     # Pure form validation utilities
│   ├── contract.ts       # Soroban contract interaction & RPC submission
│   ├── amount.ts         # Token amount parsing & formatting
│   └── format.ts         # Date, duration, and address formatting
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

---

## 🔒 State Management & Wallet Handoff

- **Wallet Session**: Managed centrally by `WalletProvider` in `components/wallet-provider.tsx`.
- **Session Auto-Restoration**: Upon mounting, `WalletProvider` probes Freighter's connection and authorization state so returning users remain signed in.
- **Network Normalization**: Freighter network labels (`TESTNET`, `PUBLIC`) are normalized to lowercase (`testnet`, `mainnet`) to match app configuration.
- **Network Guard**: Use `useNetworkGuard()` to detect and warn users when their wallet is connected to a different network than the app expects.

---

## ♿ Accessibility & UI Principles

- **WCAG AA Compliance**: All interactive elements must include explicit focus rings (`focus-visible:ring-2 focus-visible:ring-offset-2`).
- **Touch Targets**: All buttons, links, and form inputs must maintain a minimum touch target size of **44px x 44px**.
- **Dark & Light Themes**: Ensure high contrast ratios across both light and dark themes (`dark:bg-neutral-900 dark:text-neutral-100`).
- **ARIA Attributes**: Use appropriate semantic tags and ARIA labels (`role="alert"`, `aria-label`, `aria-busy`, `aria-live`).

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
