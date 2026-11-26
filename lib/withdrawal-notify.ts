// Opt-in browser notification when a stream's withdrawable amount first
// crosses a threshold. Everything here is local: the opt-in flag lives in this
// browser's localStorage and the notification is raised by the Notifications
// API while the tab is open. No server is involved. See
// docs/withdrawal-notifications.md.

const STORAGE_PREFIX = "tricklepay-withdraw-notify:";

export function notifyStorageKey(streamId: string): string {
  return `${STORAGE_PREFIX}${streamId}`;
}

export function readNotifyOptIn(streamId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(notifyStorageKey(streamId)) === "1";
  } catch {
    return false;
  }
}

export function writeNotifyOptIn(streamId: string, enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(notifyStorageKey(streamId), "1");
    else window.localStorage.removeItem(notifyStorageKey(streamId));
  } catch {
    // Storage can be unavailable (private mode); the opt-in just won't persist.
  }
}

/**
 * The withdrawable amount (base units) that counts as "available": one whole
 * token, or the full stream amount when that is smaller, so a short stream can
 * still notify.
 */
export function withdrawNotifyThreshold(totalAmount: bigint, decimals: number): bigint {
  const oneToken = 10n ** BigInt(decimals);
  return totalAmount < oneToken ? totalAmount : oneToken;
}

/**
 * True only on the tick where `withdrawable` moves from below the threshold to
 * at or above it. `wasAbove` is null before the first reading, which never
 * fires, so opting in while a balance is already available does not notify. A
 * withdrawal that drops the balance back below the threshold re-arms it.
 */
export function crossedThreshold(
  wasAbove: boolean | null,
  withdrawable: bigint,
  threshold: bigint,
): { above: boolean; fire: boolean } {
  const above = threshold > 0n && withdrawable >= threshold;
  return { above, fire: wasAbove === false && above };
}
