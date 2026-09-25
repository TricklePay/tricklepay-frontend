// The create-stream form's field values, as persisted to a draft
// (lib/create-form-draft.ts) and consumed by useCreateStreamForm and
// CreateStreamFields.

/** The create-stream form's raw field values, before parsing/validation. */
export type FormDraft = {
  recipient: string;
  token: string;
  amount: string;
  start: string;
  end: string;
  cliff: string;
};
