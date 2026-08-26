// A one-shot transaction success notice handed off across a redirect (e.g.
// create stream -> dashboard), since the component that submits the
// transaction is not the one that renders the confirmation. sessionStorage
// carries it across that navigation without leaking into the URL.

const STORAGE_KEY = "tricklepay:pending-notice";

// A just-consumed notice is replayed for this long so a consumer that remounts
// moments later (React StrictMode double effects, dev-mode hydration retries)
// reads the same notice instead of losing it. After the window a taken notice
// stays taken — a refresh or later navigation never repeats it.
const REPLAY_WINDOW_MS = 1000;

let lastTaken: { notice: PendingNotice; consumedAt: number } | null = null;

export interface PendingNotice {
  message: string;
  hash: string;
}

export function setPendingNotice(notice: PendingNotice): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notice));
  } catch {
    // sessionStorage unavailable (private browsing, disabled storage) — the
    // notice is a nice-to-have, not worth failing the transaction over.
  }
}

// Reads and clears the pending notice in one step, so a page refresh or a
// second mount never repeats it.
export function takePendingNotice(): PendingNotice | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      sessionStorage.removeItem(STORAGE_KEY);
      lastTaken = { notice: JSON.parse(raw) as PendingNotice, consumedAt: Date.now() };
      return lastTaken.notice;
    }
  } catch {
    // Storage unavailable or unreadable — fall through to any replayable
    // notice already consumed in this session.
    return lastTaken && Date.now() - lastTaken.consumedAt < REPLAY_WINDOW_MS
      ? lastTaken.notice
      : null;
  }
  if (lastTaken && Date.now() - lastTaken.consumedAt < REPLAY_WINDOW_MS) {
    return lastTaken.notice;
  }
  return null;
}
