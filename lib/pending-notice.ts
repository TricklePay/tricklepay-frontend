// A one-shot transaction success notice handed off across a redirect (e.g.
// create stream -> dashboard), since the component that submits the
// transaction is not the one that renders the confirmation. sessionStorage
// carries it across that navigation without leaking into the URL.

const STORAGE_KEY = "tricklepay:pending-notice";

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
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as PendingNotice;
  } catch {
    return null;
  }
}
