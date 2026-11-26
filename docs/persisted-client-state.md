# Persisted client state

The TricklePay frontend stores a small amount of state in the browser's
`localStorage` to preserve user preferences and work in progress across sessions.
This document lists what is stored, how to clear it, and the privacy posture.

## What is stored

Five pieces of state are persisted, all under keys prefixed `trickle` or
`tricklepay`:

### 1. Theme preference

- **Key:** `trickle-theme`
- **Values:** `"light"` or `"dark"`
- **Set by:** `components/theme-provider.tsx`, `setTheme()`
- **Read by:**
  - The inline bootstrap script in `app/layout.tsx` (runs before the page
    renders to avoid a flash of the wrong theme)
  - `components/theme-provider.tsx` on mount
- **Cleared by:** switching themes repeatedly (overwrites), or clearing
  browser data
- **Fallback:** If absent or unrecognised, the app reads the OS-level
  `prefers-color-scheme` media query and defaults to that (logic in
  `lib/theme.ts`, `resolveInitialTheme`)

### 2. Status filter selection

- **Key:** None — stored in the URL query string, not `localStorage`
- **Values:** `?filter=streaming`, `?filter=pending`, `?filter=completed`,
  `?filter=cancelled`, or no parameter (meaning "All")
- **Set by:** `app/page.tsx`, `setFilter()` (replaces the URL without a
  navigation)
- **Read by:** `app/page.tsx`, reads `useSearchParams().get("filter")`
- **Cleared by:** clicking the "Clear" button (removes the query parameter),
  or navigating to the dashboard without a `?filter=` parameter
- **Fallback:** "All" — every stream regardless of status

The dashboard token filter works the same way: `?token=<contract id>`, set by
`app/page.tsx`, `setTokenFilter()`, with no parameter meaning "All tokens".

The filter is **not** stored across browser sessions. Closing the tab or typing
the root URL clears it.

### 3. Create-stream form draft

- **Key:** `tricklepay-create-form-draft`
- **Value:** A JSON object with six fields: `recipient`, `token`, `amount`,
  `start`, `end`, `cliff` (all strings)
- **Set by:** `lib/create-form-draft.ts`, `writeFormDraft()`, called from
  `hooks/use-create-stream-form.ts` on every field change (debounced 500ms)
- **Read by:** `lib/create-form-draft.ts`, `readFormDraft()`, called from
  `hooks/use-create-stream-form.ts` on mount
- **Cleared by:**
  - Successful transaction submission (automatically, in
    `hooks/use-create-stream-form.ts`, `runSubmit()`)
  - User clicking "Discard draft" (explicitly, in `components/create-form.tsx`)
  - Calling `lib/create-form-draft.ts`, `clearFormDraft()` from the devtools
    console or any script on the same origin
- **Fallback:** If absent or corrupt, the form starts with all fields empty

The draft is stored so a user who closes the create page mid-fill does not lose
their progress. It does **not** store validation errors or form submission state.
For full details see [`docs/create-form-draft.md`](create-form-draft.md).

### 4. Last token used

- **Key:** `tricklepay-last-token`
- **Value:** A single token contract id (`C...`), stored as a plain string
- **Set by:** `lib/last-token.ts`, `writeLastToken()`, called from
  `hooks/use-create-stream-form.ts` when the user reaches the review step —
  i.e. once the token has passed validation
- **Read by:** `lib/last-token.ts`, `readLastToken()`, called from
  `hooks/use-create-stream-form.ts` on mount to prefill the token field of a new
  form
- **Cleared by:**
  - The **Clear saved token** control beside the token field (only shown while a
    token is remembered)
  - Calling `lib/last-token.ts`, `clearLastToken()` from the devtools console or
    any script on the same origin
  - Clearing browser data
- **Fallback:** If absent, unreadable, or not a valid contract address, the token
  field starts empty

The remembered token removes the need to retype the same 56-character address
when creating several streams in a row. It is separate from the form draft:
a restored draft always wins, and the remembered token only fills a **new**,
empty form. **Invalid values are never stored** — `writeLastToken` ignores
anything that is not a valid contract address, and `readLastToken` ignores an
invalid value already in storage.

### 5. Address labels

- **Key:** `tricklepay-address-labels`
- **Value:** A JSON object mapping a Stellar address to a label of up to 40
  characters, for example `{"GAAZ...CWN7":"Payroll"}`
- **Set by:** `lib/address-labels.ts`, `setAddressLabel()`, from the Add label /
  Edit label controls beside the From and To addresses on the stream page
- **Read by:** `components/address-label.tsx`, which shows the label beside the
  truncated address in the stream page, cards and table (the full address stays
  in the tooltip)
- **Cleared by:** the **Remove label** control on the stream page, saving an
  empty label, or clearing browser data
- **Fallback:** If absent or corrupt, no labels are shown

Labels are stored only in the browser and are not sent to the backend.

## Example stored values

Open the browser devtools console and run:

```js
// View all four items
localStorage.getItem("trickle-theme");
// → "dark" or "light" or null

localStorage.getItem("tricklepay-create-form-draft");
// → '{"recipient":"G…","token":"C…","amount":"100","start":"","end":"","cliff":""}'
// or null

localStorage.getItem("tricklepay-last-token");
// → "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" or null

// The filter is in the URL, not localStorage
new URLSearchParams(window.location.search).get("filter");
// → "streaming" or null
```

## How to clear stored state

### Clear everything (all origins)

Use the browser's **Clear browsing data** (Chrome/Edge) or **Clear recent
history** (Firefox) dialog and select **Cookies and site data** or **Site
preferences**. This clears `localStorage` for every site.

### Clear TricklePay state only

Open the browser devtools console on the TricklePay page and run:

```js
localStorage.removeItem("trickle-theme");
localStorage.removeItem("tricklepay-create-form-draft");
localStorage.removeItem("tricklepay-last-token");
localStorage.removeItem("tricklepay-address-labels");
```

Reload the page. The theme will revert to the OS preference and the create form
will be empty.

### Clear the form draft without affecting the theme

Click **Discard draft** at the bottom of the create-stream form (only visible
when a draft exists). Or run in the devtools console:

```js
localStorage.removeItem("tricklepay-create-form-draft");
```

### Clear the remembered token without affecting the draft or theme

Click **Clear saved token**, shown beside the token field while a token is
remembered. Or run in the devtools console:

```js
localStorage.removeItem("tricklepay-last-token");
```

### Reset the status filter

Click the **Clear** button next to the filter chips on the dashboard, or navigate
to the root URL (`/`) without a `?filter=` parameter.

## Privacy and data transmission

- **Nothing is sent anywhere.** The four persisted items are stored in the
  browser's `localStorage` only. They are never transmitted to the backend, the
  RPC endpoint, or any third-party service.
- **No tracking or analytics.** The frontend does not include any analytics
  scripts, tracking pixels, or telemetry. No usage data is collected.
- **Wallet addresses are not stored.** The connected wallet address is held in
  memory (React state in `components/wallet-provider.tsx`) and forgotten when
  the page is closed. It is not written to `localStorage` or any other
  persistent store.
- **Form drafts are stored locally.** The create-stream form draft includes the
  recipient address, token contract id, amount, and schedule. That data stays in
  the browser's `localStorage` until the form is submitted or discarded. It is
  readable by any script on the same origin but is not sent to the backend or
  logged.
- **The remembered token is stored locally.** The last valid token contract id
  is kept under `tricklepay-last-token` to prefill the next form. It is a public
  contract id, readable by any script on the same origin but not sent to the
  backend or logged.

## Implementation references

| What | File | Key function/constant |
| --- | --- | --- |
| Theme storage key | `lib/theme.ts` | `THEME_STORAGE_KEY` |
| Theme persistence | `components/theme-provider.tsx` | `setTheme()` |
| Theme bootstrap | `app/layout.tsx` | `THEME_INIT_SCRIPT` (inline) |
| Form draft key | `lib/create-form-draft.ts` | `FORM_DRAFT_STORAGE_KEY` |
| Form draft read/write/clear | `lib/create-form-draft.ts` | `readFormDraft()`, `writeFormDraft()`, `clearFormDraft()` |
| Form draft auto-save | `hooks/use-create-stream-form.ts` | `useEffect` with `writeFormDraft` |
| Remembered token key | `lib/last-token.ts` | `LAST_TOKEN_STORAGE_KEY` |
| Remembered token read/write/clear | `lib/last-token.ts` | `readLastToken()`, `writeLastToken()`, `clearLastToken()` |
| Remembered token prefill/save | `hooks/use-create-stream-form.ts` | `useState` initialiser, `handleSubmit` |
| Remembered token clear control | `components/create-stream-fields.tsx` | "Clear saved token" button |
| Address labels | `lib/address-labels.ts` | `ADDRESS_LABELS_STORAGE_KEY`, `setAddressLabel()` |
| Filter URL parameter | `app/page.tsx` | `useSearchParams()`, `setFilter()` |

## Summary

The TricklePay frontend stores a theme choice, a create-stream form draft, and
the last token used in `localStorage`, and a status filter in the URL query
string. None of this data is transmitted to any server. Users can clear it at any
time through the browser's data management UI, the devtools console, the in-app
"Discard draft" control, or the "Clear saved token" control beside the token
field.
