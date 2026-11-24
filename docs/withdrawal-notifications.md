# Withdrawal notifications

A recipient can opt in to a browser notification when a stream's withdrawable
amount first reaches a threshold. It runs entirely in the browser, with no
server involved.

## Settings

- **Where:** the "Notify me when a withdrawal is available" checkbox on the
  stream page. It is shown only to the stream's recipient while the stream is
  pending or streaming, and only in browsers that support the Notifications API.
- **Opt-in:** the browser permission prompt is raised only when the checkbox is
  ticked. Nothing is requested on page load.
- **Threshold:** one whole token (10^decimals base units), or the full stream
  amount when that is smaller (`withdrawNotifyThreshold` in
  `lib/withdrawal-notify.ts`).
- **Once per crossing:** the notification fires only when the withdrawable
  amount moves from below the threshold to at or above it. Opting in while the
  balance is already above the threshold does not notify. A withdrawal that
  drops the balance back below the threshold re-arms it.
- **Opt out:** untick the checkbox, or block notifications for the site in the
  browser settings.

## Privacy

- The opt-in is stored per stream in `localStorage` under
  `tricklepay-withdraw-notify:<stream id>` (value `1`). Clearing browser data
  removes it.
- The notification is raised locally by the Notifications API. No address,
  amount or stream id is sent anywhere, and there is no push service or
  background worker.
- It only works while the tab is open, because the balance is computed in the
  page (see [persisted-client-state.md](persisted-client-state.md) for the other
  keys the client stores).
