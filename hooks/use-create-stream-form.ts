"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

import { useWallet } from "@/components/wallet-provider";
import { useFormNavigationWarning } from "@/hooks/use-form-navigation-warning";
import { useNetworkGuard } from "@/hooks/use-network-guard";
import { confirmTransaction, estimateCreateStreamFee, TransactionTimeoutError } from "@/lib/contract";
import {
  TX_CONFIRMATION_TIMED_OUT_AGAIN_MESSAGE,
  TX_FAILED_CONFIRM_MESSAGE,
  wrongNetworkMessage,
} from "@/lib/contract-messages";
import { clearFormDraft, EMPTY_FORM_DRAFT, readFormDraft, writeFormDraft } from "@/lib/create-form-draft";
import { submitCreateStream } from "@/lib/create-stream-submission";
import {
  amountFieldError,
  cliffFieldError,
  CREATE_STREAM_REQUIRED_MESSAGES,
  endFieldError,
  recipientFieldError,
  tokenFieldError,
  validateCreateStreamForm,
} from "@/lib/create-stream-validation";
import { addDurationToLocal, deriveDuration, durationFieldError, isDurationUnit } from "@/lib/duration";
import { formatDuration } from "@/lib/format";
import { clearLastToken, readLastToken, writeLastToken } from "@/lib/last-token";
import { setPendingNotice } from "@/lib/pending-notice";
import { applySchedulePreset, SCHEDULE_PRESETS } from "@/lib/schedule-presets";
import { readTokenBalance } from "@/lib/token-balance";
import {
  DEFAULT_TOKEN_DECIMALS,
  getCachedTokenDecimals,
  readTokenDecimals,
} from "@/lib/token-decimals";
import { getCachedTokenMetadata, readTokenMetadata } from "@/lib/token-metadata";
import { isValidContractAddress, parseAmount, toUnix } from "@/lib/validation";
import { vestingRatePerDay } from "@/lib/vesting";
import type { BalanceCheck, CreateStreamParams, FeeEstimate, TxStage } from "@/types/contract";
import type { FormDraft } from "@/types/form";

export type CreateFormField = keyof FormDraft;
export type CreateFormErrors = Partial<Record<CreateFormField, string>>;
// Excludes durationUnit: it's a <select> that is always one of a fixed set of
// options, never free text, so unlike every other field it has no error state
// and nothing ever needs to focus it.
export type FocusableCreateFormField = Exclude<CreateFormField, "durationUnit">;
export type CreateFormRefs = Record<FocusableCreateFormField, RefObject<HTMLInputElement | null>>;

/** Everything CreateForm needs from useCreateStreamForm. */
export interface CreateStreamForm {
  sender: string | null;
  values: FormDraft;
  errors: CreateFormErrors;
  refs: CreateFormRefs;
  setField: (field: CreateFormField, value: string) => void;
  /** Fills start/end/cliff from a named preset — see lib/schedule-presets.ts. */
  applyPreset: (presetId: string) => void;
  previewRate: bigint | null;
  previewDuration: string | null;
  addressesValid: boolean;
  mismatch: boolean;
  submitting: boolean;
  stage: TxStage | null;
  timeoutHash: string | null;
  error: string | null;
  prepared: CreateStreamParams | null;
  /** Decimal precision of the stream token (defaults to 7). */
  tokenDecimals: number;
  /** Visible notice when decimals cannot be read and fall back to 7. */
  decimalsNotice: string | null;
  /** Best-effort network-fee estimate for the stream under review. */
  feeEstimate: FeeEstimate;
  /** Best-effort read of the sender's balance for the stream under review. */
  balanceCheck: BalanceCheck;
  /**
   * The token contract id remembered from the last stream, offered as the
   * default for a new form. Null when nothing valid is remembered.
   */
  rememberedToken: string | null;
  /** Forgets the remembered token so a new form no longer offers it. */
  clearRememberedToken: () => void;
  handleSubmit: (e: FormEvent) => Promise<void>;
  handleConfirm: () => Promise<void>;
  handleRecoverTimeout: () => Promise<void>;
  backToEdit: () => void;
}


// Fields in on-screen order, which is also the order the first invalid one is
// searched for on submit. Cliff is the only optional field.
const FIELD_ORDER: FocusableCreateFormField[] = [
  "recipient",
  "token",
  "amount",
  "start",
  "durationAmount",
  "end",
  "cliff",
];

/**
 * Owns the create-stream form's data handling: field values (persisted as a
 * draft), live validation, the review step, and the create / timeout-recovery
 * transactions. Presentation lives in CreateForm and CreateStreamFields.
 */
export function useCreateStreamForm(): CreateStreamForm {
  const wallet = useWallet();
  const { mismatch, walletNetwork, expectedNetwork } = useNetworkGuard();
  const router = useRouter();

  const [values, setValues] = useState<FormDraft>(() => {
    const draft = readFormDraft();
    // A restored draft wins. Otherwise offer the last token used, so creating
    // several streams in a row does not mean retyping the same address.
    if (draft) return draft;
    return { ...EMPTY_FORM_DRAFT, token: readLastToken() ?? "" };
  });
  // True when the form was initialised from a persisted draft, so the
  // navigation warning can tell the user their work is safe in storage.
  const [restoredFromDraft] = useState(() => readFormDraft() !== null);
  // The token remembered from the last stream, offered as the default for a
  // new form and clearable on demand. See lib/last-token.ts.
  const [rememberedToken, setRememberedToken] = useState<string | null>(() => readLastToken());
  const [tokenDecimals, setTokenDecimals] = useState<number>(() => {
    return (values.token ? getCachedTokenDecimals(values.token) : null) ?? DEFAULT_TOKEN_DECIMALS;
  });
  const [decimalsNotice, setDecimalsNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<CreateFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<TxStage | null>(null);
  const [timeoutHash, setTimeoutHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Non-null once the form has been validated and the user is on the review
  // step. Holds the exact parameters confirm will submit, so the review always
  // shows what will actually go on-chain.
  const [prepared, setPrepared] = useState<CreateStreamParams | null>(null);

  // Best-effort network-fee estimate for the reviewed stream. Starts
  // "unavailable" so nothing is claimed before the review step; re-runs each
  // time the user reaches review. A failure here never blocks confirming.
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate>({ status: "unavailable" });
  // Monotonic token so a slow estimate from a previous review can never
  // overwrite the current one (e.g. after going back and editing).
  const feeEstimateToken = useRef(0);
  // Best-effort read of the sender's token balance, so a shortfall is shown on
  // the review step before signing. Starts "unavailable" like the fee estimate,
  // and a failed read never blocks confirming.
  const [balanceCheck, setBalanceCheck] = useState<BalanceCheck>({ status: "unavailable" });
  const balanceCheckToken = useRef(0);

  // Refs used to focus the first invalid field on submit
  const refs: CreateFormRefs = {
    recipient: useRef<HTMLInputElement>(null),
    token: useRef<HTMLInputElement>(null),
    amount: useRef<HTMLInputElement>(null),
    start: useRef<HTMLInputElement>(null),
    end: useRef<HTMLInputElement>(null),
    cliff: useRef<HTMLInputElement>(null),
    durationAmount: useRef<HTMLInputElement>(null),
  };

  const { recipient, token, amount, start, end, cliff, durationAmount, durationUnit } = values;

  // The decimals effect must read the *current* amount without re-fetching
  // decimals every time the user types one. A ref gives it the latest value
  // while keeping the dependency list down to `token`.
  const amountRef = useRef(amount);
  amountRef.current = amount;

  function setFieldErrors(next: CreateFormErrors) {
    setErrors((prev) => ({ ...prev, ...next }));
  }

  // Fills `end` from `nextStart` + a duration, when the duration is a
  // complete, valid value — the shortcut that drives `end`, one direction
  // only. Called whenever start, durationAmount, or durationUnit changes, so
  // the filled-in end always matches the most recently entered duration.
  // Returns whether it actually applied, so callers can skip re-validating
  // `end` against a value this is about to replace anyway.
  function applyDurationIfSet(nextStart: string, nextAmount: string, nextUnit: string): boolean {
    if (!isDurationUnit(nextUnit) || durationFieldError(nextAmount) || !nextAmount) {
      return false;
    }
    const computedEnd = addDurationToLocal(nextStart, nextAmount, nextUnit);
    if (computedEnd === null) return false;

    setValues((prev) => ({ ...prev, end: computedEnd }));
    setFieldErrors({
      end: endFieldError(nextStart, computedEnd),
      ...(cliff ? { cliff: cliffFieldError(nextStart, computedEnd, cliff) } : {}),
    });
    return true;
  }

  useEffect(() => {
    if (!token || !isValidContractAddress(token)) {
      setTokenDecimals(DEFAULT_TOKEN_DECIMALS);
      setDecimalsNotice(null);
      return;
    }

    let active = true;
    if (!getCachedTokenMetadata(token)) {
      readTokenMetadata(token).catch(() => {});
    }

    readTokenDecimals(token)
      .then((dec) => {
        if (!active) return;
        setTokenDecimals(dec);
        setDecimalsNotice(null);
        if (amountRef.current) {
          setFieldErrors({ amount: amountFieldError(amountRef.current, dec) });
        }
      })
      .catch(() => {
        if (!active) return;
        setTokenDecimals(DEFAULT_TOKEN_DECIMALS);
        setDecimalsNotice("Could not read token decimals from contract. Defaulting to 7 decimals.");
        if (amountRef.current) {
          setFieldErrors({ amount: amountFieldError(amountRef.current, DEFAULT_TOKEN_DECIMALS) });
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  // Updates one field and re-runs the validation that depends on it, including
  // end and cliff when the window they are checked against moves.
  function setField(field: CreateFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    switch (field) {
      case "recipient":
        setFieldErrors({ recipient: recipientFieldError(value) });
        break;
      case "token":
        setFieldErrors({ token: tokenFieldError(value) });
        break;
      case "amount":
        setFieldErrors({ amount: amountFieldError(value, tokenDecimals) });
        break;

      case "start": {
        // A duration already set takes over filling `end` for the new start;
        // only fall back to checking it against the unchanged end value when
        // there is no duration to reapply.
        const applied = applyDurationIfSet(value, durationAmount, durationUnit);
        const endErr = !applied && value && end ? endFieldError(value, end) : undefined;
        setFieldErrors({
          start: value ? undefined : CREATE_STREAM_REQUIRED_MESSAGES.start,
          ...(!applied && value && end ? { end: endErr } : {}),
          ...(!applied && value && cliff ? { cliff: cliffFieldError(value, end, cliff) } : {}),
        });
        if (!applied && value && end && !endErr) {
          const derived = deriveDuration(value, end, durationUnit);
          if (derived) {
            setValues((prev) => ({
              ...prev,
              durationAmount: derived.amount,
              durationUnit: derived.unit,
            }));
            setFieldErrors({ durationAmount: undefined });
          }
        }
        break;
      }
      case "end": {
        if (!value) {
          setFieldErrors({
            end: CREATE_STREAM_REQUIRED_MESSAGES.end,
            durationAmount: undefined,
          });
          setValues((prev) => ({ ...prev, durationAmount: "" }));
          break;
        }
        const endErr = start ? endFieldError(start, value) : undefined;
        setFieldErrors({
          end: endErr,
          ...(cliff ? { cliff: cliffFieldError(start, value, cliff) } : {}),
        });
        if (start && !endErr) {
          const derived = deriveDuration(start, value, durationUnit);
          if (derived) {
            setValues((prev) => ({
              ...prev,
              durationAmount: derived.amount,
              durationUnit: derived.unit,
            }));
            setFieldErrors({ durationAmount: undefined });
          }
        }
        break;
      }
      case "cliff":
        setFieldErrors({ cliff: value ? cliffFieldError(start, end, value) : undefined });
        break;
      case "durationAmount":
        setFieldErrors({ durationAmount: durationFieldError(value) });
        applyDurationIfSet(start, value, durationUnit);
        break;
      case "durationUnit":
        applyDurationIfSet(start, durationAmount, value);
        break;
    }
  }

  // Fills start/end/cliff from a named preset in one go. Recipient, token,
  // and amount are never touched — presets are purely a schedule shortcut.
  // Keeps an already-entered start rather than overwriting it, so applying a
  // preset after picking a start date schedules from that date, not from now.
  function applyPreset(presetId: string) {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const applied = applySchedulePreset(preset, start);
    if (!applied) return;

    const cliffValue = applied.cliff ?? "";
    setValues((prev) => ({
      ...prev,
      start: applied.start,
      end: applied.end,
      cliff: cliffValue,
      durationAmount: preset.duration.amount,
      durationUnit: preset.duration.unit,
    }));
    setFieldErrors({
      start: undefined,
      end: endFieldError(applied.start, applied.end),
      cliff: cliffFieldError(applied.start, applied.end, cliffValue),
      durationAmount: undefined,
    });
  }

  const addressesValid =
    !!recipient && !!token && !recipientFieldError(recipient) && !tokenFieldError(token);

  // Live vesting-rate preview: only when amount and window are complete and
  // error-free, so an incomplete or invalid form never shows a rate.
  const previewRate =
    amount && start && end && !errors.amount && !errors.start && !errors.end
      ? vestingRatePerDay(parseAmount(amount, tokenDecimals), toUnix(start), toUnix(end))
      : null;


  // Live duration preview, only for a valid window; end-before-start already
  // flags the End field, so no misleading negative or zero span is shown.
  const previewDuration =
    start && end && !errors.start && !errors.end
      ? formatDuration(toUnix(end) - toUnix(start))
      : null;

  // durationUnit is excluded: a <select> always has a value ("days" by
  // default), so unlike every other field it is never meaningfully "empty".
  const hasUnsavedChanges =
    prepared !== null ||
    [recipient, token, amount, start, end, cliff, durationAmount].some(
      (value) => value.trim().length > 0,
    );

  // When the form was populated from a stored draft, let the user know that
  // their work is safe: the draft stays in storage even if they navigate away.
  // A form with fresh (non-draft) edits warns that changes will be discarded.
  const navigationMessage = restoredFromDraft
    ? "You have a restored draft. Your progress is saved and will be here when you return."
    : "You have unsaved changes in this stream form. Leaving now will discard them.";

  useFormNavigationWarning(hasUnsavedChanges && !submitting, navigationMessage);
  useEffect(() => {
    const draft = { recipient, token, amount, start, end, cliff, durationAmount, durationUnit };
    // durationUnit always has a value (a <select> defaults to "days"), so it
    // alone never counts as "something was entered" — only durationAmount does.
    const hasAnyValue =
      [recipient, token, amount, start, end, cliff, durationAmount].some(
        (value) => value.trim().length > 0,
      );

    if (!hasAnyValue) {
      clearFormDraft();
      return;
    }

    writeFormDraft(draft);
  }, [amount, cliff, durationAmount, durationUnit, end, recipient, start, token]);

  // Runs the pre-signing simulation in the background to surface the network
  // fee on the review step. Best-effort: on failure the review shows the fee as
  // unavailable and the user can still confirm and sign. The token guards
  // against a stale estimate overwriting a newer one.
  async function estimateFee(params: CreateStreamParams) {
    const token = ++feeEstimateToken.current;
    setFeeEstimate({ status: "loading" });
    try {
      const stroops = await estimateCreateStreamFee(params);
      if (token === feeEstimateToken.current) setFeeEstimate({ status: "ready", stroops });
    } catch {
      if (token === feeEstimateToken.current) setFeeEstimate({ status: "unavailable" });
    }
  }

  // Reads the sender's token balance in the background so the review step can
  // flag a shortfall before signing. Best-effort: a failed read is shown as
  // unavailable and never blocks confirming. The token guards against a stale
  // read overwriting a newer one.
  async function checkBalance(params: CreateStreamParams) {
    const token = ++balanceCheckToken.current;
    setBalanceCheck({ status: "loading" });
    try {
      const balance = await readTokenBalance(params.token, params.sender);
      if (token !== balanceCheckToken.current) return;
      const shortfall = balance < params.totalAmount ? params.totalAmount - balance : null;
      setBalanceCheck({ status: "ready", balance, shortfall });
    } catch {
      if (token === balanceCheckToken.current) setBalanceCheck({ status: "unavailable" });
    }
  }

  // Forgets the remembered token so a new form no longer offers it. Only the
  // stored preference is cleared; the current field value is untouched.
  function clearRememberedToken() {
    clearLastToken();
    setRememberedToken(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !wallet.address) return;
    setError(null);

    if (mismatch) {
      setError(
        wrongNetworkMessage(walletNetwork ?? "unknown", expectedNetwork),
      );
      return;
    }

    // Re-run the shared rules at submit time so a stale live error can never
    // disagree with what is accepted for the transaction.
    const validationErrors = validateCreateStreamForm(values, tokenDecimals);
    setErrors(validationErrors);
    const firstInvalid = FIELD_ORDER.find((field) => !!validationErrors[field]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    const startTime = toUnix(start);
    const endTime = toUnix(end);
    const cliffTime = cliff ? toUnix(cliff) : startTime;

    // Validation passed: show the review step. The transaction itself only
    // goes out once the user confirms there.
    const params: CreateStreamParams = {
      sender: wallet.address,
      recipient,
      token,
      totalAmount: parseAmount(amount, tokenDecimals),
      startTime,
      endTime,
      cliffTime,
    };
    setPrepared(params);

    // Remember the token for next time. Reached only once the whole form —
    // including the token — has passed validation, so an invalid value is never
    // stored; writeLastToken re-checks before writing as a second line of
    // defence.
    writeLastToken(token);
    setRememberedToken(token);

    // Kick off the fee estimate and balance read in the background; neither
    // blocks the review from rendering.
    void estimateFee(params);
    void checkBalance(params);
  }

  async function handleConfirm() {
    if (!prepared || submitting) return;
    setError(null);

    setSubmitting(true);
    setStage("preparing");
    try {
      const result = await submitCreateStream(prepared, (s) => setStage(s));
      if (result.ok) {
        setPendingNotice({ message: "Stream created.", hash: result.hash });
        setTimeoutHash(null);
        clearFormDraft();
        router.push("/");
      } else {
        if (result.timeoutHash) setTimeoutHash(result.timeoutHash);
        setError(result.message);
      }
    } finally {
      setSubmitting(false);
      setStage(null);
    }
  }

  async function handleRecoverTimeout() {
    if (!timeoutHash) return;
    setSubmitting(true);
    setStage("confirming");
    setError(null);
    try {
      await confirmTransaction(timeoutHash, (s) => setStage(s));
      setPendingNotice({ message: "Stream created.", hash: timeoutHash });
      setTimeoutHash(null);
      clearFormDraft();
      router.push("/");
    } catch (err) {
      if (err instanceof TransactionTimeoutError) {
        setError(TX_CONFIRMATION_TIMED_OUT_AGAIN_MESSAGE);
      } else {
        setError(err instanceof Error ? err.message : TX_FAILED_CONFIRM_MESSAGE);
      }
    } finally {
      setSubmitting(false);
      setStage(null);
    }
  }

  return {
    sender: wallet.address,
    values,
    errors,
    refs,
    setField,
    applyPreset,
    previewRate,
    previewDuration,
    addressesValid,
    mismatch,
    submitting,
    stage,
    timeoutHash,
    error,
    prepared,
    tokenDecimals,
    decimalsNotice,
    feeEstimate,
    balanceCheck,
    rememberedToken,
    clearRememberedToken,
    handleSubmit,
    handleConfirm,
    handleRecoverTimeout,
    backToEdit: () => {

      // Discard any in-flight reads so a late result can't land on the next
      // review the user opens.
      feeEstimateToken.current += 1;
      setFeeEstimate({ status: "unavailable" });
      balanceCheckToken.current += 1;
      setBalanceCheck({ status: "unavailable" });
      setPrepared(null);
    },
  };
}
