# Dashboard totals

The dashboard shows aggregate figures for incoming and outgoing streams. This
document explains how those totals are computed, what they include, and whether
filters affect them.

## What the dashboard shows

Each stream section (Incoming and Outgoing) displays two numbers in its header:

- **Visible count** — the number of streams currently loaded and shown on screen
- **Total count** — the full number of streams matching the current query

Example: `"25 of 142"` means 25 streams are visible and 142 exist for that
role and filter combination. The "Load more" button remains available until the
visible count equals the total.

## How totals are computed

The `total` figure comes from the backend's paginated response (`lib/api.ts`,
`listStreams`). The backend counts every stream where the connected wallet is
the sender (for Outgoing) or the recipient (for Incoming), applying any status
filter selected.

The frontend hook (`hooks/use-stream-page.ts`, `useStreamPage`) tracks:

- `streams` — the list of streams loaded and rendered so far
- `total` — the full result set size from the most recent backend response
- `fetched` — how many rows have been requested (may be higher than
  `streams.length` if duplicates were dropped)

The visible count shown on screen is `streams.length`. The total is `total`.

## Do filters affect the totals?

**Yes.** The status filter (All, Streaming, Pending, Completed, Cancelled)
changes which streams are counted.

- When **All** is selected, the total includes every stream where the wallet is
  party to the role (sender or recipient), regardless of status.
- When a specific status is selected (e.g., **Streaming**), the backend filters
  both the returned streams and the total count to include only streams with
  that status.

The filter is passed to the backend as a query parameter (`status`) in
`hooks/use-stream-page.ts` (`pageQuery`). Changing the filter resets the list
to page 0 and refetches the total.

## Implementation

- **Hook:** `hooks/use-stream-page.ts`, exported as `useStreamPage`
- **Query builder:** `pageQuery(role, address, offset, status)` constructs the
  backend request
- **Backend API:** `lib/api.ts`, `listStreams({ sender?, recipient?, status?, limit, offset })`
- **Dashboard UI:** `app/page.tsx`, `StreamSection` component displays the
  counts

The hook calls `listStreams` with:

- `sender: address` (for Outgoing) or `recipient: address` (for Incoming)
- `status: "streaming" | "pending" | "completed" | "cancelled"` (when a filter
  is active), or no status parameter (when "All" is selected)
- `limit: 25` (page size, `PAGE_SIZE` constant)
- `offset: fetched` (the number of rows already loaded)

The backend responds with `{ streams: StreamView[], total: number }`. The
frontend renders the length of the accumulated `streams` array and the most
recent `total` from the response.

## Pagination and duplicate handling

If a stream is created or cancelled between page loads, the same stream can
arrive in two consecutive pages (because the offset shifts when the result set
changes). The hook deduplicates by stream `id` (`setStreams` in `loadMore`)
so React keys stay unique, but counts every returned row against `fetched` so
the next page's offset is correct.

If a page arrives empty (the result set shrank since the last request), the hook
sets `total = fetched` so the "Load more" button disappears rather than sticking
in an unusable state.

## Refresh behaviour

The dashboard refetches page 0 silently:

- On window focus
- On visibility change (tab becomes active)
- Every 15 seconds (if the page is visible and a wallet is connected)

Silent refreshes update both the visible streams and the total count. If a
silent refresh fails (network error, backend unreachable), it fails silently and
the existing on-screen data remains.

Manual refresh (clicking the "Refresh" button) resets to page 0 and surfaces
errors.

## Summary

The dashboard totals represent the full result set from the backend for the
current role (sender or recipient) and status filter. The visible count is the
number of streams loaded so far. Filters change what is counted. Pagination and
deduplication ensure the counts stay correct even when streams are created or
cancelled between requests.
