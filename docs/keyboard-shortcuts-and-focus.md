# Keyboard shortcuts and focus order

The TricklePay frontend is fully keyboard navigable. This document describes the
expected focus order for each view, lists any keyboard shortcuts, and explains
how to verify the order after a change.

## Keyboard shortcuts

The application has **one global shortcut**:

- **Tab** (on page load) → reveals the skip link ("Skip to main content").
  Pressing **Enter** on the skip link jumps focus to `<main id="main-content">`,
  bypassing the header.

No other application-wide shortcuts exist. Standard browser shortcuts (refresh,
back/forward, find in page, devtools) work as expected.

## Focus order by view

Focus follows the visual reading order: top to bottom, left to right. Every
interactive control (link, button, input) is reachable by pressing **Tab** in
sequence, and **Shift+Tab** goes backward.

### Dashboard (`app/page.tsx`)

When a wallet is connected:

1. **Skip link** (hidden until focused)
2. **Header**:
   - "TricklePay" home link
   - "Streams" link (desktop)
   - "New stream" link (desktop)
   - Theme toggle button
   - Wallet button (shows connected address or "Connect wallet")
   - Mobile menu toggle (mobile only, `≡` icon)
3. **Filter chips** (All, Streaming, Pending, Completed, Cancelled, Clear)
4. **Incoming section**:
   - "Refresh" button
   - Each stream card (link wrapping the entire card)
   - "Load more" button (if more streams exist)
5. **Outgoing section**:
   - "Refresh" button
   - Each stream card (link wrapping the entire card)
   - "Load more" button (if more streams exist)
   - "Create a new stream" link (if no outgoing streams exist)

When no wallet is connected, focus order is: skip link, header (links, theme,
wallet button, menu), and the "create a new stream" link in the page body.

### Create stream page (`app/create/page.tsx`)

1. **Skip link**
2. **Header** (same as dashboard)
3. **Form fields** (in the order they appear on screen):
   - Recipient address (text input)
   - Token (text input)
   - Amount (text input)
   - Start time (datetime-local input)
   - End time (datetime-local input)
   - Cliff time (datetime-local input, optional)
4. **Submit button** ("Create stream")
5. **Discard draft** link (if a draft exists)

When the form is submitted with validation errors, focus moves programmatically
to the first invalid field (`hooks/use-create-stream-form.ts`,
`use-create-stream-form.ts`, field focus on validation failure).

### Stream detail page (`app/streams/[id]/page.tsx`)

1. **Skip link**
2. **Header** (same as dashboard)
3. **Stream card** (non-interactive display)
4. **Action controls** (if the connected wallet is a party to the stream):
   - **Withdraw panel** (for recipients):
     - Amount input
     - "Max" button (sets amount to withdrawable balance)
     - "Withdraw" button
   - **Cancel panel** (for senders):
     - "Cancel this stream" button
     - Confirmation prompt (appears when clicked, becomes a focus trap):
       - Warning text
       - "Yes, cancel the stream" button
       - "Keep streaming" button
5. **Timeout recovery alert** (if a transaction timed out):
   - "Check transaction status" button

Focus is **trapped** inside the cancel confirmation dialog when it is open
(`components/cancel-stream-control.tsx`). Pressing **Tab** cycles between the
two buttons. Pressing **Escape** closes the dialog and returns focus to the
"Cancel this stream" button that opened it.

### Loading, error, and not-found states

- **Loading states** (`app/loading.tsx`, `components/loading-state.tsx`):
  focus order is skip link, header. The loading spinner is `role="status"` and
  announced to screen readers but not focusable.
- **Error state** (`app/error.tsx`): skip link, header, "Try again" button,
  "Go to dashboard" link.
- **Not found** (`app/not-found.tsx`): skip link, header, "Go to dashboard" link.

### Mobile menu

When the mobile menu is open (`components/header.tsx`), focus moves into the
menu and **does not trap** — pressing **Tab** beyond the last menu item moves to
the next control outside the header. The menu can be closed by clicking the
toggle again or by clicking outside it.

Focus order inside the mobile menu:

1. Menu toggle button (to close it)
2. "Streams" link
3. "New stream" link

## Focus visibility

Every interactive control shows a visible focus indicator when reached by
keyboard. The global rule in `app/globals.css` applies a 2px `indigo-500`
outline with 2px offset to all `:focus-visible` elements.

Many controls replace the outline with a custom ring (e.g., `focus-visible:ring-2`
in Tailwind utility classes). The indicator is always present — it is only the
style that varies.

For full details on focus visibility commitments, see
[`docs/accessibility.md`](accessibility.md#12-keyboard-focus-is-always-visible).

## How the focus order is implemented

- **Tab order follows DOM order.** Interactive elements are rendered in the
  order they should be focused. The app does **not** use `tabindex` (except
  `tabindex="-1"` on the `<main>` element to make it programmatically focusable
  for the skip link). No reordering or custom tab sequences exist.
- **Skip link:** `components/skip-link.tsx`, an `<a href="#main-content">`
  with `sr-only` (hidden until focused) and `focus-visible:not-sr-only`
  (revealed on focus).
- **Programmatic focus on validation failure:**
  `hooks/use-create-stream-form.ts` calls `.focus()` on the first invalid field
  ref when the form is submitted with errors.
- **Focus trap in cancel confirmation:**
  `components/cancel-stream-control.tsx` renders an `alertdialog` that cycles
  focus between its two buttons. The trap is active only while the dialog is
  open.

## How to verify focus order after a change

### Manual verification

1. Load the page in a browser.
2. Press **Tab** repeatedly.
3. Observe that:
   - Every interactive control receives focus in visual reading order.
   - Every focused element shows a visible indicator (outline or ring).
   - No control is skipped, and no non-interactive element receives focus.
   - **Shift+Tab** moves backward in the same order.
4. Repeat in both **dark** and **light** themes — the focus indicator must be
   visible against both backgrounds.
5. Repeat on **mobile** (narrow viewport) to verify the mobile menu and
   collapsed header.

For the create page specifically:

1. Submit the empty form.
2. Verify that focus moves to the **Recipient** field (the first invalid field).
3. Fill in Recipient only and resubmit.
4. Verify that focus moves to the **Token** field (the next invalid field).

For the stream detail page (cancel flow):

1. Click **Cancel this stream**.
2. Press **Tab** — focus should move between the two confirmation buttons only,
   not escape the dialog.
3. Press **Escape** — the dialog should close and focus should return to the
   "Cancel this stream" button.

### Automated verification

No automated test currently exercises the full focus order. Tests verify
specific behaviours (e.g., form field focus on validation failure in
`hooks/use-create-stream-form.test.tsx`, focus trap logic in
`components/cancel-stream-control.test.tsx`), but do not walk the entire tab
sequence.

To add focus-order tests:

1. Mount the component or page in a jsdom environment (Vitest `@vitest-environment jsdom`).
2. Query all focusable elements (links, buttons, inputs):
   ```ts
   const focusable = container.querySelectorAll(
     'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
   );
   ```
3. Assert that `focusable` is in the expected order by comparing `href`,
   `textContent`, or `aria-label` attributes.

### Command-line checks

- **Verify skip link target exists:**
  ```bash
  grep -rn 'id="main-content"' app components
  ```
  Every `<main>` in a page or loading/error state should carry this id.

- **Find custom tabindex usage:**
  ```bash
  grep -rn 'tabindex' app components
  ```
  The only valid uses are `tabindex="-1"` (on `<main>`, to make it focusable for
  the skip link) and `tabindex="0"` or positive integers for custom focus
  sequences (which the app should avoid).

- **Find suppressed focus outlines:**
  ```bash
  grep -rn 'outline-none' app components
  ```
  Every match should have a corresponding `focus-visible:ring-*` replacement.

## Known limitations

- **No skip-to-navigation shortcut.** The skip link only targets the main
  content, not the header navigation. Users who want to reach the header must
  tab through the skip link first.
- **No keyboard shortcut to open the mobile menu.** On narrow viewports, users
  must tab to the menu toggle button and press **Enter**. There is no shortcut
  (e.g., a single key) to open it directly.
- **No skip-to-filter or skip-to-actions shortcuts.** Within a page, users must
  tab through every control in sequence. There is no shortcut to jump to the
  filter chips or the withdraw/cancel controls on the stream detail page.

These are not defects — the tab-through path is short and the skip link covers
the most common case (skipping the header). They are listed here so future
contributors know what the project does not currently offer.

## Summary

The TricklePay frontend has one keyboard shortcut: the skip link (Tab on page
load, Enter to activate). Focus order follows visual reading order (top to
bottom). Every control is reachable by Tab, and every focused element shows a
visible indicator. To verify the order after a change, tab through the page
manually in both themes and on mobile, and ensure every interactive control is
reached in sequence without gaps or skips.
