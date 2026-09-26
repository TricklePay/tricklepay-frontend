// A one-shot transaction success notice handed off across a redirect (e.g.
// create stream -> dashboard). See lib/pending-notice.ts.

export interface PendingNotice {
  message: string;
  hash: string;
}
