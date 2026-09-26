/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";

import type { FormDraft } from "@/types/form";

import { clearFormDraft, readFormDraft, writeFormDraft } from "./create-form-draft";

// A half-filled form as a user might leave it before a reload: some fields
// filled, the optional cliff still empty.
const HALF_FILLED_DRAFT: FormDraft = {
  recipient: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  amount: "12.5",
  start: "2026-08-27T10:00",
  end: "2026-08-27T12:00",
  cliff: "",
};

describe("create-form-draft", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores a draft and reads it back unchanged", () => {
    writeFormDraft(HALF_FILLED_DRAFT);

    expect(readFormDraft()).toEqual(HALF_FILLED_DRAFT);
  });

  it("clears the draft after a successful submission so stale values are not restored", () => {
    // The form persists the half-filled values while the user works...
    writeFormDraft(HALF_FILLED_DRAFT);
    expect(readFormDraft()).toEqual(HALF_FILLED_DRAFT);

    // ...and the successful-submission path clears it (see
    // useCreateStreamForm.handleConfirm -> clearFormDraft).
    clearFormDraft();

    expect(readFormDraft()).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});
