// Helpers for preserving and restoring scroll position across navigations.
// Stores scroll positions and return flags in sessionStorage so users
// returning to the dashboard from a stream retain their position, while
// fresh visits start cleanly at the top of the page.

const SCROLL_POS_PREFIX = "tricklepay:scroll_pos:";
const FROM_STREAM_KEY = "tricklepay:from_stream_detail";

export function getSessionItem(key: string): string | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function setSessionItem(key: string, value: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // Ignore quota or private-browsing restrictions
  }
}

export function removeSessionItem(key: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

export function saveDashboardScroll(search = ""): void {
  if (typeof window === "undefined") return;
  setSessionItem(`${SCROLL_POS_PREFIX}${search}`, String(window.scrollY));
}

export function getSavedDashboardScroll(search = ""): number | null {
  const val = getSessionItem(`${SCROLL_POS_PREFIX}${search}`);
  if (val === null) return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}

export function markNavigatingToStream(search = ""): void {
  saveDashboardScroll(search);
  setSessionItem(FROM_STREAM_KEY, "true");
}

export function isReturningFromStream(): boolean {
  return getSessionItem(FROM_STREAM_KEY) === "true";
}

export function clearReturningFromStream(): void {
  removeSessionItem(FROM_STREAM_KEY);
}
