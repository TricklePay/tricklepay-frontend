# Documentation

Reference documentation for the TricklePay frontend, beyond what fits in the
[root README$](../README.md).

| Document | Describes |
| --- | --- |
| [accessibility.md](accessibility.md) | The accessibility commitments the project holds — skip link, focus visibility and handling, live announcements, form labelling, reduced motion and more — with the code that implements each, how to verify it, and the known gaps that are *not* commitments. |
| [compatibility.md](compatibility.md) | The compatibility matrix between the client, the REST API, and the Soroban stream contract: supported version combinations, failure modes, contract error codes 1–13 understood by the client, and update procedures. |
| [api-contract.md](api-contract.md) | The frontend's contract with both backends it depends on — the read-only tricklepay-backend REST API and the on-chain Soroban stream contract: request/response shapes, amount and time encoding, the write transaction lifecycle, and the on-chain error-code mapping. |
| [api-contract-mock.md](api-contract-mock.md) | How to enable the mock API mode (`NEXT_PUBLIC_MOCK_API=true`) and what the five fixture streams in `lib/mock-api.ts` represent — a mid-flight stream, a pending stream, a completed stream, a cancelled stream, and a large long-running stream — so you can develop layout and interactions without a running backend. |
| [component-conventions.md](component-conventions.md) | Component and data-hook boundaries, providers, write-operation callbacks, file locations, return types, and the `"use client"` directive. |
| [hook-conventions.md](hook-conventions.md) | Hook naming, state and action return shapes, derived values, effect cleanup, reuse, and testing conventions. |
| [component-testing.md](component-testing.md) | How to set up a component test: Vitest configuration, provider setup, mocking patterns, and DOM querying. Points to existing tests as examples of testing presentational components, hooks, and interactive behaviour. |
| [adding-contract-error-messages.md](adding-contract-error-messages.md) | How to add or change a contract error message: where the authoritative codes are, the steps to update the table, tests and docs, and how to write an actionable message. |
| [api-error-handling.md](api-error-handling.md) | The API error handling contract: the error codes the backend returns, the category each code belongs to, how the client branches on that category, and what the user sees for each. |
| [balance-interpolation.md](balance-interpolation.md) | Why balances advance locally between fetches instead of polling the API every second, how often authoritative data is fetched, and why the ledger clock remains the source of truth. |
| [create-form-draft.md](create-form-draft.md) | Why the create-stream form can already be filled in when you open it: what is stored in `localStorage`, when a draft is saved and restored, and every way to discard one. |
| [create-form-validation.md](create-form-validation.md) | Every rule the create-stream form enforces before a transaction is built, the exact message each one shows, and when it runs. |
| [dashboard-totals.md](dashboard-totals.md) | How the dashboard totals are computed: what the visible and total counts represent, whether filters affect them, pagination and deduplication handling, and refresh behaviour. |
| [keyboard-shortcuts-and-focus.md](keyboard-shortcuts-and-focus.md) | The expected keyboard focus order for each view, the one global shortcut (skip link), and how to verify the order after a change. Includes focus trap behaviour and known limitations. |
| [local-setup.md](local-setup.md) | Start-to-finish guide to running the frontend on your own machine: prerequisites, every environment variable and where its value comes from, how to verify the setup works, and what common first-run failures mean. |
| [persisted-client-state.md](persisted-client-state.md) | What the client stores in the browser: theme choice, form drafts, the last token used, and the status filter. Lists every `localStorage` key, how to clear them, and the privacy posture (nothing is sent anywhere). |
| [slow-network.md](slow-network.md) | How the client handles a slow network: backend request timeouts and cancellation, and the recovery path for an on-chain transaction that doesn't confirm in time. |
| [timeout-recovery.md](timeout-recovery.md) | What it means when a transaction's confirmation times out — why the transaction may still settle — and how to recover it with a re-check or the block explorer. |
| [token-metadata.md](token-metadata.md) | How token symbols, names and decimals are read from token contracts, the session cache and 5 minute failure cache, the known-token and 7 decimals fallbacks and their effect on displayed amounts, and how to add a known token. |
| [transaction-write-path.md](transaction-write-path.md) | A sequence diagram of an on-chain write from the form to confirmation — network guard, account lookup, simulation, wallet signing, submission and confirmation polling — marking where each failure and its message is raised. |
| [visual-regression.md](visual-regression.md) | What the visual smoke test captures, when a snapshot should be updated deliberately, and how to review a diff. |
