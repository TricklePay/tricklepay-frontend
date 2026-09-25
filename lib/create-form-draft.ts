import type { FormDraft } from "@/types/form";

const FORM_DRAFT_STORAGE_KEY = "tricklepay-create-form-draft";

export const EMPTY_FORM_DRAFT: FormDraft = {
  recipient: "",
  token: "",
  amount: "",
  start: "",
  end: "",
  cliff: "",
};

/** Restores the create-stream form draft saved in localStorage, if any. */
export function readFormDraft(): FormDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(FORM_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<FormDraft>;

    return {
      recipient: parsed.recipient ?? "",
      token: parsed.token ?? "",
      amount: parsed.amount ?? "",
      start: parsed.start ?? "",
      end: parsed.end ?? "",
      cliff: parsed.cliff ?? "",
    };
  } catch {
    return null;
  }
}

export function writeFormDraft(values: FormDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(FORM_DRAFT_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Ignore storage failures from private browsing or quota limits.
  }
}

export function clearFormDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(FORM_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage failures from private browsing or quota limits.
  }
}
