// Local address book: names a user gives to counterparty addresses. Browser
// only (localStorage), never sent anywhere. See docs/persisted-client-state.md.

export const ADDRESS_LABELS_STORAGE_KEY = "tricklepay-address-labels";
export const ADDRESS_LABELS_CHANGED_EVENT = "tricklepay-address-labels-changed";
export const MAX_LABEL_LENGTH = 40;

export type AddressLabels = Record<string, string>;

export function readAddressLabels(): AddressLabels {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ADDRESS_LABELS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const labels: AddressLabels = {};
    for (const [address, label] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof label === "string" && label.trim()) {
        labels[address] = label.trim().slice(0, MAX_LABEL_LENGTH);
      }
    }
    return labels;
  } catch {
    return {};
  }
}

/** Saves a label for an address. An empty label removes it. */
export function setAddressLabel(address: string, label: string): void {
  if (typeof window === "undefined") return;
  const next = { ...readAddressLabels() };
  const trimmed = label.trim().slice(0, MAX_LABEL_LENGTH);
  if (trimmed) {
    next[address] = trimmed;
  } else {
    delete next[address];
  }
  try {
    window.localStorage.setItem(ADDRESS_LABELS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode, quota); the label is just not kept.
  }
  window.dispatchEvent(new Event(ADDRESS_LABELS_CHANGED_EVENT));
}

export function removeAddressLabel(address: string): void {
  setAddressLabel(address, "");
}
