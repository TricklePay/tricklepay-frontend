# Component testing

Component tests in this project verify presentational logic, prop handling, and
interactive behaviour without mounting a full browser or requiring network calls.
This document explains how to set up a component test, how providers are
supplied, and points to existing tests as examples.

## Test setup

Component tests use **Vitest** as the runner and React's `createRoot` from
`react-dom/client` to render components in a jsdom environment. Tests do **not**
use React Testing Library — they query the DOM directly with standard
`querySelector` and `querySelectorAll`.

### File location and naming

Test files live alongside the components they test:

```
components/
  stream-card.tsx
  stream-card.test.tsx
  header.tsx
  header.test.tsx
```

The naming convention is `<component-name>.test.tsx`. Every test file has the
`.test.tsx` extension so Vitest discovers it.

### Basic test structure

```tsx
/* @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

import { YourComponent } from "./your-component";

describe("YourComponent", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the expected content", async () => {
    await act(async () => {
      root.render(<YourComponent />);
    });

    expect(container.textContent).toContain("Expected text");
  });
});
```

Key elements:

1. **`/* @vitest-environment jsdom */`** at the top — enables DOM APIs
   (`document`, `window`, `HTMLElement`) in Node.
2. **`createRoot(container)`** — React 18's rendering API. Use it instead of the
   legacy `render()` from `react-dom`.
3. **`act()`** — wraps renders and user interactions so React can flush effects
   and state updates before assertions. Always `await act(async () => { … })`.
4. **Cleanup in `afterEach`** — unmount the tree and remove the container so
   tests don't leak DOM nodes or event listeners.

## How providers are supplied in tests

Components that consume context (wallet, theme) need the corresponding provider
wrapping them in tests. There are two approaches:

### 1. Mock the context hook

If the component only reads from a context, mock the hook it calls:

```tsx
import { vi } from "vitest";

const mockUseWallet = vi.fn();
vi.mock("@/components/wallet-provider", () => ({
  useWallet: () => mockUseWallet(),
}));

// In the test:
mockUseWallet.mockReturnValue({
  address: "GABC…",
  connected: true,
  // … other wallet state
});
```

Example: [`components/header.test.tsx`](../components/header.test.tsx) mocks
`usePathname` from `next/navigation`.

### 2. Render the provider explicitly

If the component or its children call context setters (e.g., `toggleTheme`,
`connect`), wrap the test render in the real provider:

```tsx
import { WalletProvider } from "@/components/wallet-provider";

await act(async () => {
  root.render(
    <WalletProvider>
      <YourComponent />
    </WalletProvider>
  );
});
```

The provider will initialise its own state. If you need to control what it
provides, either:

- Call the context setter in the test (e.g., click the wallet button to trigger
  `connect()`)
- Pass initial state to the provider if it accepts props (the wallet and theme
  providers do not — they read from the DOM and `window` on mount)

### 3. For simple presentational components, no providers needed

If the component receives all its data as props and does not call any context
hooks, render it directly:

```tsx
await act(async () => {
  root.render(<StreamCard stream={mockStream} />);
});
```

Example: [`components/stream-card.test.tsx`](../components/stream-card.test.tsx)
renders `StreamCard` with a mock `StreamView` prop. No providers.

## Mocking modules

To replace an import with a test double, use Vitest's `vi.mock()`:

```tsx
import { vi } from "vitest";

// Mock next/navigation
const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock a component that's not relevant to the test
vi.mock("@/components/wallet-button", () => ({
  WalletButton: () => <div data-testid="wallet-button">Wallet</div>,
}));
```

Place `vi.mock()` calls **before** the component import, at the top of the file
after the Vitest imports. The mock will intercept all imports of that module in
the test.

Restore mocks after each test to avoid leaking state:

```tsx
afterEach(() => {
  vi.restoreAllMocks();
});
```

## Querying the rendered DOM

Tests query the DOM using standard `querySelector` methods:

```tsx
const button = container.querySelector('button[aria-label="Refresh"]');
expect(button).not.toBeNull();

const links = container.querySelectorAll("a[href]");
expect(links.length).toBe(2);

expect(container.textContent).toContain("Expected string");
```

For attribute checks:

```tsx
const link = container.querySelector('a[href="/create"]');
expect(link?.getAttribute("aria-current")).toBe("page");
```

## Simulating user interactions

Wrap clicks and input changes in `act()`:

```tsx
const button = container.querySelector("button");
await act(async () => {
  button?.click();
});

const input = container.querySelector("input");
await act(async () => {
  input!.value = "new value";
  input!.dispatchEvent(new Event("input", { bubbles: true }));
});
```

## Example tests

| Test file | What it demonstrates |
| --- | --- |
| [`components/stream-card.test.tsx`](../components/stream-card.test.tsx) | Simple prop-driven component, no providers, no mocks. Passes different `StreamView` props and asserts the rendered output. |
| [`components/header.test.tsx`](../components/header.test.tsx) | Mocks `next/navigation` (`usePathname`) and child components (`WalletButton`, `ThemeToggle`). Renders with `createRoot`, queries nav links, simulates button clicks. |
| [`components/theme-toggle.test.tsx`](../components/theme-toggle.test.tsx) | Wraps the component in `ThemeProvider`, simulates clicks, reads `localStorage` and the DOM class to verify theme changes. |
| [`hooks/use-stream-page.test.tsx`](../hooks/use-stream-page.test.tsx) | Tests a hook directly by rendering it inside a tiny harness component with `act`. Mocks `lib/api.ts` to control responses. |
| [`hooks/use-create-stream-form.test.tsx`](../hooks/use-create-stream-form.test.tsx) | Tests form validation, draft save/restore, and transaction submission by rendering the hook in a harness, stubbing `localStorage`, and mocking contract calls. |

Start with `stream-card.test.tsx` for a minimal example, then look at
`header.test.tsx` for provider/mock patterns.

## What to test

Focus on:

- **Prop handling:** does the component render correctly for different prop values?
- **Conditional rendering:** does it show/hide elements based on props or state?
- **User interactions:** does clicking a button call the expected callback or
  update the UI?
- **Accessibility:** do ARIA attributes, roles, and labels appear correctly?

Do **not** test:

- **Styling:** CSS classes and layout are verified visually, not in unit tests.
- **Integration with real backends:** mock API calls and contract functions.
- **Browser-specific behaviour:** jsdom is not a real browser. Test keyboard
  navigation, focus trapping, and touch interactions manually.

## Running tests

Run all tests:

```bash
npm test
```

Run tests for a specific file:

```bash
npm test stream-card
```

Run tests in watch mode (re-runs on file change):

```bash
npm test -- --watch
```

Run tests with coverage:

```bash
npm test -- --coverage
```

## Gotchas and common issues

### `act()` warnings

If you see `"Warning: An update to X inside a test was not wrapped in act(…)"`,
wrap the interaction that caused the update (render, click, state change) in
`act()`.

### `localStorage is not defined`

jsdom provides `localStorage` by default in recent versions. If you see this
error, check that the test file has `/* @vitest-environment jsdom */` at the top.

### Mocks not working

Mocks must be declared **before** the component import. This works:

```tsx
vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
import { Header } from "./header";
```

This does **not**:

```tsx
import { Header } from "./header"; // already imported — mock is too late
vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
```

### Async components

Next.js `async` components (server components) cannot be tested this way. Test
their client children or the hooks they would call instead.

## Summary

Component tests live alongside components with a `.test.tsx` extension. They use
Vitest, `createRoot`, and `act()` to render and interact with components in
jsdom. Providers are mocked or rendered explicitly as needed. Query the DOM
directly with `querySelector`. See `components/stream-card.test.tsx` for a
minimal example and `components/header.test.tsx` for a full setup with mocks and
providers.
