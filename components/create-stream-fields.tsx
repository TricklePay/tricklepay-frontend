import type { JSX, FormEvent, ReactNode } from "react";

import type { CreateFormErrors, CreateFormField, CreateFormRefs } from "@/hooks/use-create-stream-form";
import { formatAmount } from "@/lib/format";
import { formatUtcFromLocalInput, resolvedTimeZoneLabel } from "@/lib/timezone";
import type { FormDraft } from "@/types/form";

function Field({
  label,
  error,
  errorId,
  children,
}: {
  label: string;
  error?: string;
  /** id to apply to the error span so aria-describedby references resolve. */
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-400">{label}</span>
      {children}
      {error && (
        <span id={errorId} role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-500";

const inputErrorClass =
  "rounded border border-red-500 bg-neutral-900 px-3 py-2 text-sm focus:border-red-400";

interface FieldsProps {
  values: FormDraft;
  errors: CreateFormErrors;
  refs: CreateFormRefs;
  onFieldChange: (field: CreateFormField, value: string) => void;
}

// Start, end, and cliff share one shape: a local datetime input with its UTC
// equivalent shown underneath.
function DateTimeField({
  name,
  label,
  values,
  errors,
  refs,
  onFieldChange,
}: FieldsProps & { name: "start" | "end" | "cliff"; label: string }) {
  const error = errors[name];
  const utc = formatUtcFromLocalInput(values[name]);

  return (
    <Field label={label} error={error} errorId={`${name}-error`}>
      <input
        id={`field-${name}`}
        ref={refs[name]}
        className={error ? inputErrorClass : inputClass}
        type="datetime-local"
        value={values[name]}
        onChange={(e) => onFieldChange(name, e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : utc ? `${name}-utc` : undefined}
      />
      {!error && utc && (
        <span id={`${name}-utc`} className="text-xs text-neutral-500">
          {utc}
        </span>
      )}
    </Field>
  );
}

/**
 * The create-stream form's inputs, live previews, and submit button. Purely
 * presentational: values, errors, and handlers come from useCreateStreamForm.
 */
export function CreateStreamFields({
  previewRate,
  previewDuration,
  feedback,
  submitting,
  submitDisabled,
  onSubmit,
  ...fields
}: FieldsProps & {
  previewRate: bigint | null;
  previewDuration: string | null;
  feedback: ReactNode;
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: (e: FormEvent) => void;
}): JSX.Element {
  const { values, errors, refs, onFieldChange } = fields;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Recipient address" error={errors.recipient} errorId="recipient-error">
        <input
          id="field-recipient"
          ref={refs.recipient}
          className={errors.recipient ? inputErrorClass : inputClass}
          value={values.recipient}
          onChange={(e) => onFieldChange("recipient", e.target.value)}
          placeholder="G... or C..."
          aria-invalid={!!errors.recipient}
          aria-describedby={errors.recipient ? "recipient-error" : undefined}
        />
      </Field>
      <Field label="Token contract id" error={errors.token} errorId="token-error">
        <input
          id="field-token"
          ref={refs.token}
          className={errors.token ? inputErrorClass : inputClass}
          value={values.token}
          onChange={(e) => onFieldChange("token", e.target.value)}
          placeholder="C..."
          aria-invalid={!!errors.token}
          aria-describedby={errors.token ? "token-error" : undefined}
        />
      </Field>
      <Field label="Amount" error={errors.amount} errorId="amount-error">
        <input
          id="field-amount"
          ref={refs.amount}
          className={errors.amount ? inputErrorClass : inputClass}
          value={values.amount}
          onChange={(e) => onFieldChange("amount", e.target.value)}
          placeholder="100"
          inputMode="decimal"
          aria-invalid={!!errors.amount}
          aria-describedby={errors.amount ? "amount-error" : "amount-hint"}
        />
        {!errors.amount && (
          <span id="amount-hint" className="text-xs text-neutral-500">
            Up to 7 decimal places (e.g. 1.0000001)
          </span>
        )}
      </Field>
      <p className="text-xs text-neutral-500">
        Start, end, and cliff below use your local timezone —{" "}
        <span className="text-neutral-400">{resolvedTimeZoneLabel()}</span>.
      </p>

      <DateTimeField name="start" label="Start" {...fields} />
      <DateTimeField name="end" label="End" {...fields} />

      {previewDuration !== null && (
        <p className="rounded border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-400">
          Stream duration:{" "}
          <span className="font-medium text-neutral-100">{previewDuration}</span>
        </p>
      )}

      {previewRate !== null && (
        <p className="rounded border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-400">
          Vesting rate:{" "}
          <span className="font-medium text-neutral-100">
            {formatAmount(previewRate.toString())}
          </span>{" "}
          tokens/day, released linearly from start to end.
        </p>
      )}

      <DateTimeField name="cliff" label="Cliff (optional)" {...fields} />

      {feedback}

      <button
        type="submit"
        disabled={submitDisabled}
        className="mt-2 rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Review stream"}
      </button>
    </form>
  );
}
