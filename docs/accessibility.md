# Accessibility commitments

Several accessibility features in this frontend exist deliberately. This
document writes down what the project commits to, which code implements each
commitment, and how to check it still holds — so that a later change can't
quietly remove one.

**If a change would weaken or remove a commitment below, update this document
in the same pull request** so the decision is visible in review rather than
discovered later.

## Scope and how to read this

- It covers the TricklePay web UI in this repository. It does not cover the
  Freighter wallet extension or third-party sites we link to (Stellar Expert).
- **Commitments** (section 1) are behaviours that exist in the code today and
  must be preserved.
- **Known gaps** (section 3) are things the README, CONTRIBUTING.md or common
  practice might lead you to assume, but which the code does not currently
  guarantee. They are listed so nobody mistakes them for commitments. The
  project does **not** currently claim conformance with WCAG or any other
  accessibility standard; no formal audit has been run.

## 1. Commitments

Each commitment lists what we hold, the code that implements it, the rule for
new code, and how to verify it. File paths are given without line numbers so
they stay accurate as the code moves.

### 1.1 Keyboard users can skip the header

Every page can be reached past the header with one keystroke.

- **Implemented by:** `components/skip-link.tsx` (an `<a href="#main-content">`
  hidden with `sr-only` and revealed on focus), rendered first inside the
  providers in `app/layout.tsx`, before `<Header />`.
- **Target:** every `<main>` in `app/` and `components/` carries
  `id="main-content"` — the dashboard (loading, disconnected and connected
  states), the create page, stream detail (loading, error, not-found and loaded
  states), `app/loading.tsx`, `app/error.tsx` and `app/not-found.tsx`.
- **Rule:** any new page, or new state of a page that renders its own `<main>`,
  must use `<main id="main-content">`.
- **Verify:**
  - Manual: load a page, press `Tab` once — "Skip to main content" appears.
    Press `Enter`, then `Tab` again: focus should land inside the page content,
    not back in the header. Repeat for the loading, error and not-found states.
  - Command: `grep -rn "<main" app components` — every non-test match must
    include `id="main-content"`.

### 1.2 Keyboard focus is always visible

Anything reachable by keyboard shows where focus is, in both themes.

- **Implemented by:** the global `:focus-visible` rule in `app/globals.css`
  (2px solid `indigo-500`, 2px offset). It applies to keyboard and programmatic
  focus only, so mouse and touch clicks are unaffected. `indigo-500` is chosen
  because it is documented there as keeping at least 3:1 contrast against both
  the dark and light backgrounds.
- **Per-component rings:** many controls replace the outline with
  `focus-visible:outline-none focus-visible:ring-2 …` (for example the stream
  cards, table links, filter chips and copy buttons). Controls without their own
  style rely on the global rule.
- **Rule:** never remove the focus indicator without replacing it. Using
  `outline-none` (or `focus:outline-none`) is only acceptable alongside an
  equivalent `focus-visible:` ring.
- **Verify:** Tab through each page in dark and light themes; every interactive
  control must show an indicator. Search for suppressed outlines with
  `grep -rn "outline-none" app components` and confirm each has a
  `focus-visible:ring-*` next to it.

### 1.3 A failed form submit moves focus to the problem

- **Implemented by:** `hooks/use-create-stream-form.ts` focuses the first
  invalid field, in on-screen order (`FIELD_ORDER`: recipient, token, amount,
  start, end, cliff), when the create form is submitted with errors. The refs
  are attached to the inputs in `components/create-stream-fields.tsx`.
- **Rule:** a form that blocks submission on validation errors must move focus
  to the first offending field.
- **Verify:** on the create page, submit the empty form — focus lands on
  Recipient. Fill it in and resubmit with a later field wrong — focus lands on
  that field. (There is currently no automated test for this; see section 3.)

### 1.4 Loading, progress, outcomes and errors are announced

Changes that a sighted user would notice on screen are announced to screen
readers without moving focus.

| Kind | How | Where |
| --- | --- | --- |
| Loading | `role="status"`, `aria-live="polite"`, `aria-busy="true"` on skeleton loading; spinner is `role="status"` with an `sr-only` label | `components/loading-state.tsx`, `components/brand-spinner.tsx` |
| Transaction progress | `role="status"`, `aria-live="polite"`, `aria-label="Transaction progress"` | `components/transaction-progress.tsx` |
| Transaction success | `role="status"`, `aria-live="polite"` (explorer link has an `sr-only` "opens in a new tab") | `components/transaction-notice.tsx` |
| Copy confirmation | nested `sr-only` `role="status"` / `aria-live="polite"` reading "Copied … to clipboard" | `components/copy-button.tsx` |
| Live balance | `sr-only` polite status announcing the withdrawable balance on an interval, only while a stream is `streaming` | `components/stream-detail.tsx` |
| Offline status | `role="status"`, `aria-live="polite"`, `aria-atomic="true"` always-mounted live region; renders a non-dismissible notice while offline and clears automatically when back online | `components/offline-banner.tsx` |
| Errors that block the user | `role="alert"` (assertive) | field errors in `components/create-stream-fields.tsx`; form error in `components/create-form.tsx`; wallet errors and wrong-network warning in `components/wallet-button.tsx`; confirmation timeout in `components/timeout-recovery-alert.tsx` |
| Destructive confirmation | `role="alertdialog"` labelled by its question | `components/cancel-stream-control.tsx` |

- **Rule:** progress and success use polite regions; errors that stop the user
  use `role="alert"`. New loading states should go through
  `components/loading-state.tsx` so they are announced the same way everywhere.
- **Verify:**
  - Automated (attributes only): `components/loading-state.test.tsx`,
    `components/brand-spinner.test.tsx`, `components/transaction-progress.test.tsx`,
    `components/transaction-notice.test.tsx`, `components/copy-button.test.tsx`,
    `app/loading.test.tsx`. Playwright specs `cancel-confirm.spec.ts` and
    `create-withdraw.spec.ts` assert the alertdialog and status region appear.
  - Manual (the only check that proves speech): with VoiceOver or NVDA running,
    trigger each case — submit the create form with errors, create a stream,
    copy an address, start a cancel — and confirm the message is spoken without
    you having to navigate to it.

### 1.5 Form fields are labelled, and errors are tied to their fields

- **Implemented by:** in `components/create-stream-fields.tsx` every field is
  wrapped in a `<label>`; each input sets `aria-invalid` and an
  `aria-describedby` that points at its error message (or its hint / UTC
  preview when there is no error). The withdraw controls in
  `components/withdraw-panel.tsx` do the same: the amount input has an
  `aria-label`, `aria-invalid`, and `aria-describedby` for its hint, error or
  blocked-reason text, and the "Max" button has an explicit `aria-label`.
- **Rule:** every new input needs an accessible name. If it can fail
  validation, it needs `aria-invalid`, and `aria-describedby` must reference an
  element id that actually renders when the message is shown.
- **Verify:** in browser DevTools, open the Accessibility pane, select each
  input and confirm the computed name and description. With a screen reader,
  tab into an invalid field and confirm it reads the label and the error.

### 1.6 Decorative content is hidden; hidden meaning is provided

- **Implemented by:** `aria-hidden="true"` on purely decorative elements (the
  spinner dots, skeleton placeholders, status-badge glyph, legend dot and icon
  SVGs in the header, theme toggle, copy/share and refresh controls); `sr-only`
  text where meaning would otherwise be lost (the spinner label, "opens in a new
  tab", the status legend's descriptions, and the dashboard's `<h1>Your
  streams</h1>`). Icon-only controls carry an `aria-label`: navigation toggle,
  theme toggle, copy and share buttons, notice dismiss, refresh and clear
  filters, disconnect wallet (which includes the address).
- **Rule:** an icon-only control must have an `aria-label`; a decorative icon
  must be `aria-hidden`; a `target="_blank"` link must carry `rel="noopener
  noreferrer"` and, for links our own code renders as the primary action, an
  `sr-only` "(opens in a new tab)".
- **Verify:** `grep -rn "aria-hidden\|sr-only" app components` and review new
  matches; `grep -rn 'target="_blank"' app components` and check each for `rel`
  and the `sr-only` text (the known exception is listed in section 3).

### 1.7 Status is never conveyed by colour alone

- **Implemented by:** each stream status has an icon, a text label and a
  description in `lib/stream-status.ts`; `components/stream-status-badge.tsx`
  shows the icon (hidden from assistive tech) plus the status word;
  `components/stream-status-legend.tsx` pairs each colour with a text label and
  an `sr-only` description. Dashboard filter chips expose state through
  `aria-pressed` as well as styling. Field errors show text, not just a red
  border.
- **Rule:** any new state that uses colour to mean something must also carry a
  text label or icon.
- **Verify:** in Chrome DevTools → Rendering → "Emulate vision deficiencies"
  (achromatopsia), confirm streaming, pending, completed and cancelled streams
  are still distinguishable. `components/stream-status-badge.test.tsx` covers
  the badge markup.

### 1.8 Pages have a proper document structure

- **Implemented by:** `<html lang="en">` in `app/layout.tsx`; a `<header>` with
  two labelled navs (`aria-label="Main navigation"` and `"Mobile navigation"`)
  in `components/header.tsx`; the mobile menu button exposes `aria-expanded` and
  `aria-controls`; a `<main>` per page (see 1.1); an `<h1>` for each page's main
  content (the dashboard's is visually hidden when connected); the stream table
  uses `<th scope="col">`; key/value detail uses `<dl>`; and every route has a
  document title (the `"%s — TricklePay"` template in `app/layout.tsx`, plus the
  status-prefixed title on stream detail via `hooks/use-stream-title.ts` and
  `lib/document-title.ts`).
- **Rule:** new pages get an `<h1>`, a title, and the landmarks above; data
  tables use `<th scope>`.
- **Verify:** DevTools Accessibility tree (or a headings/landmarks extension) on
  each page: one `<h1>`, sensible heading order, `banner` and `main` landmarks.
  `e2e/visual-smoke.spec.ts` looks up the `banner` and `main` roles.

### 1.9 Motion respects the operating-system preference

- **Implemented by:** the `@media (prefers-reduced-motion: reduce)` rule in
  `app/globals.css`, which sets `animation-duration` and `transition-duration`
  to 0.01ms, `animation-iteration-count` to 1, and `scroll-behavior` to `auto`
  for every element. It covers the spinner bounce, skeleton pulse and hover/focus
  transitions in one place.
- **Rule:** animate with CSS so this rule applies. JavaScript-driven animation
  is not covered and must check the media query itself.
- **Verify:** enable "Reduce motion" in your OS, or use DevTools → Rendering →
  "Emulate CSS media feature prefers-reduced-motion: reduce", and confirm the
  spinner and skeletons stop animating.

### 1.10 Both themes are supported and the user's choice is respected

- **Implemented by:** dark by default; light through a `light` class on `<html>`
  that inverts the neutral colour tokens in `app/globals.css`; `color-scheme` is
  set so native controls match; the choice is persisted and applied before first
  paint, falling back to the OS `prefers-color-scheme` when nothing is stored
  (`app/layout.tsx`, `lib/theme.ts`); the header toggle
  (`components/theme-toggle.tsx`) has an `aria-label` naming the action ("Switch
  to light theme" / "Switch to dark theme").
- **Verify:** toggle the theme and step through each page in both. Unit tests:
  `lib/theme.test.ts`, `components/theme-toggle.test.tsx`. Note that only the
  focus ring's contrast is documented — see section 3.

### 1.11 Forced colors (Windows High Contrast) mode is honoured

Status indicators, badges, legends, and progress bars remain distinguishable when
the operating system overrides background and foreground colors.

- **Implemented by:** `@media (forced-colors: active)` rules in `app/globals.css`,
  explicit system borders (`forced-colors:border-[ButtonBorder]`) in
  `components/stream-status-badge.tsx`, boundary borders on status dots in
  `components/stream-status-legend.tsx`, and system colors (`Highlight`,
  `CanvasText`) for the track, fill, and cliff marker in
  `components/progress-bar.tsx`.
- **Approach for new components:**
  1. Never rely solely on CSS background colors to convey meaning or boundaries;
     forced-colors mode overrides backgrounds with system defaults.
  2. Provide explicit borders (e.g. `border` or `forced-colors:border-[ButtonBorder]`)
     on badges, cards, and interactive pills.
  3. Pair colors with text labels or distinct icons (see commitment 1.7).
  4. When custom fills or graphical indicators are necessary (such as progress bars
     or indicator dots), use `forced-color-adjust: none` alongside standard system
     colors (`CanvasText`, `Highlight`, `ButtonText`) or explicit borders to maintain
     visibility.
- **Verify:** In Chrome DevTools → Rendering → "Emulate CSS media feature forced-colors: active"
  (or Windows High Contrast Mode), verify that status badges, the status legend,
  and progress indicators retain visible borders and distinct indicators.

## 2. How to verify, in general

### Automated checks that exist today

| Check | What it covers | Limits |
| --- | --- | --- |
| `npm run lint` | `eslint-config-next` enables six `jsx-a11y` rules: `alt-text`, `aria-props`, `aria-proptypes`, `aria-unsupported-elements`, `role-has-required-aria-props`, `role-supports-aria-props` | Warnings only, so they do not fail CI; the fuller `jsx-a11y` recommended set (label association, keyboard handlers, `anchor-is-valid`) is not enabled |
| `npm test` (Vitest) | Attribute-level assertions listed under 1.4, 1.7 and 1.10 | Runs in Node without a DOM: it checks the markup we emit, not focus behaviour or what a screen reader says |
| `npm run test:e2e` (Playwright) | Finds elements by role and label; asserts the cancel alertdialog and status regions appear | Does not check focus order, keyboard-only use or announcements |
| CI (`.github/workflows/ci.yml`) | Runs `npm run lint`, `npm run typecheck` and `npm run build` | Does **not** run `npm test` or the Playwright suite |

### Axe checks in component tests

`components/a11y.axe.test.tsx` renders components in jsdom and runs
[axe-core](https://github.com/dequelabs/axe-core) on them: the create stream
form fields (empty and with errors), transaction progress and the dashboard
status legend. Any violation fails `npm test` and lists the rule, its impact,
the help text and the offending selector.

To cover a new component, render it and assert on `axeViolations` from
`test/axe.ts`:

```tsx
/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { axeViolations } from "@/test/axe";

it("has no axe violations", async () => {
  const { container } = render(<MyComponent />);
  expect(await axeViolations(container)).toEqual([]);
});
```

`color-contrast` is skipped because jsdom does not paint, so axe cannot
compute colours there. To track an existing violation instead of fixing it in
the same change, pass its rule id as the second argument and link the issue
next to it, so new violations of other rules still fail.

```tsx
// Tracks one existing violation, linked to its issue, while every other rule
// still fails the test.
expect(await axeViolations(container, ["label" /* #123 */])).toEqual([]);
```

The third argument, `enabledRules`, turns on experimental rules that
axe-core disables by default.

#### What jsdom covers and what needs the browser

| Covered by axe in jsdom | Needs a real browser |
| --- | --- |
| Accessible names for buttons, links and inputs | Colour contrast (`color-contrast` is off, jsdom does not paint) |
| Form label association and ARIA attribute validity | Focus order, focus visibility and focus traps |
| Roles, required ARIA children and duplicate ids | Layout-dependent rules such as touch-target size and reflow |
| Image alt text and document-level markup on what is rendered | What a screen reader announces and the live-region timing |

Axe in jsdom only sees the component you render, not the whole page, so a
landmark or heading problem that depends on the full page layout will not show
up there.

#### Page-level checks

These run against the built app in a browser:

- [`.github/lighthouse/check-lighthouse.mjs`](../.github/lighthouse/check-lighthouse.mjs)
  checks the dashboard and create pages against accessibility score floors and a
  list of required audits, including `color-contrast`, in the `lighthouse` job
  of [`ci.yml`](../.github/workflows/ci.yml).
- The Playwright specs in [`e2e/`](../e2e/README.md), for example
  `visual-smoke.spec.ts`, which looks up landmarks by role.
- The manual pass in the next section, for keyboard, screen reader and forced
  colors.

### Manual pass for any pull request that changes UI

Do this in a real browser; none of it is covered by automation.

1. **Keyboard only.** Unplug the mouse. `Tab` and `Shift+Tab` through the changed
   screens; every control is reachable, in a sensible order, with a visible
   focus indicator (1.2). Activate with `Enter` / `Space`.
2. **Skip link.** `Tab` once from the top of the page (1.1).
3. **Forms.** Submit with errors; focus moves to the first invalid field and
   each error is announced (1.3, 1.4, 1.5).
4. **Screen reader spot-check.** VoiceOver (macOS) or NVDA (Windows): run through
   creating a stream, watching progress and the success notice, copying an
   address, and starting a cancel (1.4).
5. **Themes.** Repeat the keyboard pass in dark and light (1.10).
6. **Reduced motion.** Emulate `prefers-reduced-motion: reduce` (1.9).
7. **Forced colors.** Emulate `forced-colors: active` (1.11).
8. **Colour.** Emulate achromatopsia and confirm nothing depends on colour
   alone (1.7).
9. **Structure.** Check headings and landmarks in the Accessibility tree (1.8).

## 3. Known gaps — not commitments

These are stated so a reader does not assume otherwise. Fixing one is welcome;
when you do, move it into section 1 with its verification.

- **Touch-target size.** Key interactive controls have been measured and enlarged
  to meet the 44×44px mobile touch target guideline (including `CopyButton`,
  filter pills, search clear, filter clear, table action links, refresh, retry,
  theme toggle, and notice dismiss). Remaining controls outside primary workflows
  aim for the 24×24px WCAG 2.5.8 minimum and are audited when touched.
- **Conformance and contrast.** No WCAG conformance is claimed and no audit has
  been done. The only contrast ratio documented (≥3:1) is the focus ring's, and
  it is asserted in comments, not measured by a tool. Text and status-colour
  contrast in either theme is not verified.
- **CONTRIBUTING.md wording.** Its "Accessibility & UI Principles" section says
  every interactive element must use `focus-visible:ring-2
  focus-visible:ring-offset-2` and refers to `dark:` classes. In practice many
  controls rely on the global outline (1.2), rings vary in offset, and the code
  uses no `dark:` classes — theming is done through inverted CSS variables.
  Where that section and this document differ, this document describes what the
  code does today.
- **Some errors are not announced.** These render as plain text with no
  `role="alert"`: the withdraw/cancel action error (`components/stream-actions.tsx`),
  the withdraw amount error (`components/withdraw-panel.tsx`), a failed
  dashboard list load (`app/page.tsx`), and a failed stream fetch
  (`app/streams/[id]/page.tsx`).
- **Cancel dialog focus.** The cancel confirmation uses `role="alertdialog"` but
  does not move focus into it, does not trap focus, and has no `aria-describedby`.
- **Mobile navigation drawer.** No `Escape` to close, no focus trap and no focus
  return to the menu button; the drawer is only in the DOM while open, so
  `aria-controls` points at a missing id while it is closed.
- **Unmarked new-tab links.** The two Freighter links in
  `components/browser-support-note.tsx` open in a new tab without the `sr-only`
  "(opens in a new tab)" text.
- **Heading structure.** The stream detail fetch-error state has no `<h1>`; the
  disconnected dashboard jumps from `<h1>` to `<h3>` in the browser-support
  note; the stream table has no caption or accessible name.
- **Required fields.** No input uses `required` or `aria-required`; the optional
  Cliff field is marked only by "(optional)" in its label.
- **No focus management on transitions.** Focus is not moved on route changes,
  when entering or leaving the review step, or when the cancel dialog closes.
- **Test coverage.** No test covers the skip link's real target, first-invalid
  focus, reduced motion or `lang`. `app/layout.test.tsx` mocks the skip link.
  `e2e/visual-smoke.spec.ts` asserts a `contentinfo` landmark although the app
  renders no `<footer>`, so that assertion looks unable to pass.
- **CI.** Because CI does not run `npm test` or Playwright, the tests above
  guard these commitments only for people who run them locally.
