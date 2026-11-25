import type { JSX, FormEvent, ReactNode } from "react";

import type { CreateFormErrors, CreateFormField, CreateFormRefs } from "@/hooks/use-create-stream-form";
import { isSelfRecipient } from "@/lib/create-stream-validation";
import { DURATION_UNITS, isStartInPast, longDurationWarning, nowAsDatetimeLocal } from "@/lib/duration";
import { formatTokenRate } from "@/lib/format";
import { nativeAssetContractId } from "@/lib/native-asset";
import { SCHEDULE_PRESETS } from "@/lib/schedule-presets";
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
  const pastStartHint = name === "start" && !error && isStartInPast(values[name]);
  const longDuration = name === "end" && !error ? longDurationWarning(values.start, values.end) : null;

  const describedBy = [
    error ? `${name}-error` : null,
    !error && utc ? `${name}-utc` : null,
    pastStartHint ? `${name}-past-hint` : null,
    longDuration ? `${name}-long-duration-hint` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Field label={label} error={error} errorId={`${name}-error`}>
      <div className="flex gap-2">
        <input
          id={`field-${name}`}
          ref={refs[name]}
          className={error ? inputErrorClass : inputClass}
          type="datetime-local"
          value={values[name]}
          onChange={(e) => onFieldChange(name, e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
        />
        {name === "start" && (
          <button
            type="button"
            onClick={() => onFieldChange("start", nowAsDatetimeLocal())}
            className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
            aria-label="Set start to the current time"
          >
            Use now
          </button>
        )}
      </div>
      {!error && utc && (
        <span id={`${name}-utc`} className="text-xs text-neutral-500">
          {utc}
        </span>
      )}
      {pastStartHint && (
        <span id="start-past-hint" className="text-xs text-amber-400">
          This start is in the past — the elapsed time will vest and become withdrawable immediately once the stream is created.
        </span>
      )}
      {longDuration && (
        <span id={`${name}-long-duration-hint`} className="text-xs text-amber-400">
          {longDuration}
        </span>
      )}
    </Field>
  );
}

// A shortcut that fills `end` from `start`: enter a whole number and pick a
// unit, and the End field fills itself in. It stays in sync with End — editing
// End directly afterwards re-computes the displayed duration (see
// lib/duration.ts and useCreateStreamForm). Disabled until Start is filled in,
// since there is nothing yet to add a duration to.
function DurationField({ values, errors, refs, onFieldChange }: FieldsProps) {
  const error = errors.durationAmount;
  const disabled = !values.start;

  return (
    <Field label="Duration (optional)" error={error} errorId="durationAmount-error">
      <div className="flex gap-2">
        <input
          id="field-durationAmount"
          ref={refs.durationAmount}
          className={`w-24 ${error ? inputErrorClass : inputClass}`}
          value={values.durationAmount}
          onChange={(e) => onFieldChange("durationAmount", e.target.value)}
          placeholder="30"
          inputMode="numeric"
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? "durationAmount-error" : "durationAmount-hint"}
        />
        <select
          id="field-durationUnit"
          className={inputClass}
          value={values.durationUnit}
          onChange={(e) => onFieldChange("durationUnit", e.target.value)}
          disabled={disabled}
          aria-label="Duration unit"
        >
          {DURATION_UNITS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </div>
      {!error && (
        <span id="durationAmount-hint" className="text-xs text-neutral-500">
          {disabled ? "Fill in Start to use this." : "Sets End from Start — e.g. 30 Days."}
        </span>
      )}
    </Field>
  );
}

// A small set of named shortcuts that fill start/end/cliff in one click (see
// lib/schedule-presets.ts). Plain buttons rather than a <select>: there are
// only three, each is a one-shot action rather than a persistent choice, and
// a button needs one click instead of a dropdown's two.
function SchedulePresets({ onApplyPreset }: { onApplyPreset: (presetId: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-400">Schedule presets</span>
      <div role="group" aria-label="Schedule presets" className="flex flex-wrap gap-2">
        {SCHEDULE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApplyPreset(preset.id)}
            className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-1 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The create-stream form's inputs, live previews, and submit button. Purely
 * presentational: values, errors, and handlers come from useCreateStreamForm.
 */
export function CreateStreamFields({
  previewRate,
  previewDuration,
  onApplyPreset,
  rememberedToken,
  onClearRememberedToken,
  walletAddress,
  feedback,
  submitting,
  submitDisabled,
  onSubmit,
  ...fields
}: FieldsProps & {
  previewRate: bigint | null;
  previewDuration: string | null;
  onApplyPreset: (presetId: string) => void;
  /** The token remembered from the last stream, or null if none is stored. */
  rememberedToken: string | null;
  /** Forgets the remembered token (see lib/last-token.ts). */
  onClearRememberedToken: () => void;
  /** The connected wallet, or null if none — flags a recipient that matches it. */
  walletAddress: string | null;
  /** Token decimal scale (defaults to 7). */
  tokenDecimals?: number;
  /** Visible notice when decimals could not be read and defaulted to 7. */
  decimalsNotice?: string | null;
  feedback: ReactNode;
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: (e: FormEvent) => void;
}): JSX.Element {
  const { values, errors, refs, onFieldChange, tokenDecimals = 7, decimalsNotice } = fields;
  const selfRecipient = isSelfRecipient(values.recipient, walletAddress);


  // Clearing the remembered token also empties the field when it is still
  // showing that token, so the preference and the form do not disagree. A
  // token the user has since edited is left alone.
  function handleClearRememberedToken() {
    onClearRememberedToken();
    if (values.token === rememberedToken) onFieldChange("token", "");
  }

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
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-invalid={!!errors.recipient}
          aria-describedby={
            errors.recipient ? "recipient-error" : selfRecipient ? "recipient-self-hint" : undefined
          }
        />
        {!errors.recipient && selfRecipient && (
          <span id="recipient-self-hint" className="text-xs text-amber-400">
            You are streaming to yourself.
          </span>
        )}
      </Field>
      <Field label="Token contract id" error={errors.token} errorId="token-error">
        <div className="flex gap-2">
          <input
            id="field-token"
            ref={refs.token}
            className={`min-w-0 flex-1 ${errors.token ? inputErrorClass : inputClass}`}
            value={values.token}
            onChange={(e) => onFieldChange("token", e.target.value)}
            placeholder="C..."
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-invalid={!!errors.token}
            aria-describedby={errors.token ? "token-error" : undefined}
          />
          <button
            type="button"
            onClick={() => onFieldChange("token", nativeAssetContractId())}
            className="shrink-0 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
            aria-label="Use native XLM as the token"
          >
            Use XLM
          </button>
        </div>
        {rememberedToken && (
          <button
            type="button"
            onClick={handleClearRememberedToken}
            className="self-start text-xs text-neutral-500 underline hover:text-neutral-300"
          >
            Clear saved token
          </button>
        )}
        {decimalsNotice && (
          <span role="status" className="text-xs text-amber-400">
            {decimalsNotice}
          </span>
        )}
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
            Up to {tokenDecimals} decimal places (e.g. 1.
            {tokenDecimals > 0 ? `${"0".repeat(Math.max(0, tokenDecimals - 1))}1` : "0"})
          </span>
        )}
      </Field>

      <p className="text-xs text-neutral-500">
        Start, end, and cliff below use your local timezone —{" "}
        <span className="text-neutral-400">{resolvedTimeZoneLabel()}</span>.
      </p>

      <SchedulePresets onApplyPreset={onApplyPreset} />

      <DateTimeField name="start" label="Start" {...fields} />
      <DurationField {...fields} />
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
            {formatTokenRate(previewRate.toString(), values.token)}
          </span>
          , released linearly from start to end.
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
