# Component conventions

This document describes the structural conventions used across the frontend.
Follow these patterns when adding or modifying components and hooks.

## The core separation: presentational components and data hooks

Components and data loading are deliberately kept in separate layers.

**Presentational components** (in `components/`) receive everything they need
as props. They contain no fetching, no API calls, and no side effects beyond
rendering and event delegation. They are synchronous and straightforward to test
in isolation. `StreamCard` is the simplest example — it takes a `StreamView` and
renders it:

```tsx
// components/stream-card.tsx
export function StreamCard({ stream }: { stream: StreamView }): JSX.Element {
  return <Link href={`/streams/${stream.id}`}>…</Link>;
}
```

**Data hooks** (in `hooks/`) own all async state: fetching, loading flags, error
state, and derived values. They return plain objects that components consume.
`useStreamPage` and `useAccrual` are the primary examples.

**Page components** (in `app/`) compose the two layers. They call hooks to obtain
data and pass the results down to presentational components as props:

```tsx
// app/page.tsx
const incoming = useStreamPage("recipient", wallet.address);
// …
<StreamSection page={incoming} … />
```

The principle is: if you need to add a fetch, put it in a hook. If you need to
add a visual, put it in a component. Only pages wire them together.

## When a component needs its own side effects

Some components are too tightly coupled to their data to separate cleanly. The
pattern is still to isolate the logic into a dedicated hook named after the
component. `StreamActions` follows this pattern:

```tsx
// components/stream-actions.tsx  — presentation only
export function StreamActions({ stream, walletAddress, onComplete }: Props) {
  const actions = useStreamActions(stream, walletAddress, onComplete);
  // renders controls, delegates all callbacks to `actions`
}

// hooks/use-stream-actions.ts  — all state and async logic
export function useStreamActions(stream, walletAddress, onComplete) {
  // withdraw, cancel, stage tracking, error state, timeout recovery
  return { busy, stage, error, runWithdraw, runCancel, … };
}
```

This keeps each file focused and ensures the component stays testable without
mocking network calls.

## Providers and context

Global state that many components need (wallet, theme) lives in a React context
provider. Providers are mounted once in `app/layout.tsx` and consumed via a
dedicated hook that asserts the context is present:

```tsx
// components/wallet-provider.tsx
export function useWallet(): WalletState {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWallet must be used inside a WalletProvider.");
  return wallet;
}
```

Do not reach for context for component-local or page-local state. Use it only
for session-scoped data that is shared across the entire tree: wallet connection
and theme preference.

## Callbacks for write operations

Components never call `lib/contract.ts` directly. Write operations (create,
withdraw, cancel) are triggered by calling a callback received as a prop or
returned from a hook. The hook handles the full transaction lifecycle and exposes
a loading/error/stage state tuple back to the component.

This means:
- A component only needs to know "is something in progress" and "call this to
  start it" — it is not aware of XDR, Freighter, or RPC.
- The transaction logic can be tested independently of the component tree.

## File locations

| What | Where |
|---|---|
| Page-level route components | `app/` |
| Presentational components | `components/` |
| Data and state hooks | `hooks/` |
| Pure utility functions | `lib/` |
| Shared TypeScript types | `types/` |

## Return type annotations

All exported functions and components explicitly annotate their return type.
React components return `JSX.Element` (or `JSX.Element | null` when conditional
rendering can return nothing). This is intentional: it keeps the types
self-documenting and avoids inference surprises at call sites.

```tsx
export function StreamCard({ stream }: { stream: StreamView }): JSX.Element { … }
export function StreamActions(…): JSX.Element | null { … }
export function useAccrual(stream: StreamView): Accrual { … }
```

## "use client" directive

Add `"use client"` at the top of any file that uses React state, effects,
event handlers, or browser APIs. Omit it from purely presentational components
that receive all their data as props and do not use any React hooks — Next.js
will render those on the server by default, which is preferable.

Both hooks and providers always need `"use client"` because they use `useState`,
`useEffect`, or `useContext`.
