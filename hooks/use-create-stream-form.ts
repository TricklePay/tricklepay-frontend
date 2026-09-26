"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

import { useWallet } from "@/components/wallet-provider";
import { useFormNavigationWarning } from "@/hooks/use-form-navigation-warning";
import { useNetworkGuard } from "@/hooks/use-network-guard";
import { confirmTransaction, TransactionTimeoutError } from "@/lib/contract";
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
import { formatDuration } from "@/lib/format";
import { setPendingNotice } from "@/lib/pending-notice";
import { parseAmount, toUnix } from "@/lib/validation";
import { vestingRatePerDay } from "@/lib/vesting";
import type { CreateStreamParams, TxStage } from "@/types/contract";
import type { FormDraft } from "@/types/form";

export type CreateFormField = keyof FormDraft;
export type CreateFormErrors = Partial<Record<CreateFormField, string>>;
export type CreateFormRefs = Record<CreateFormField, RefObject<HTMLInputElement | null>>;

/** Everything CreateForm needs from useCreateStreamForm. */
export interface CreateStreamForm {
  sender: string | null;
  values: FormDraft;
  errors: CreateFormErrors;
  refs: CreateFormRefs;
  setField: (field: CreateFormField, value: string) => void;
  previewRate: bigint | null;
  previewDuration: string | null;
  addressesValid: boolean;
  mismatch: boolean;
  submitting: boolean;
  stage: TxStage | null;
  timeoutHash: string | null;
  error: string | null;
  prepared: CreateStreamParams | null;
  handleSubmit: (e: FormEvent) => Promise<void>;
  handleConfirm: () => Promise<void>;
  handleRecoverTimeout: () => Promise<void>;
  backToEdit: () => void;
}

// Fields in on-screen order, which is also the order the first invalid one is
// searched for on submit. Cliff is the only optional field.
const FIELD_ORDER: CreateFormField[] = ["recipient", "token", "amount", "start", "end", "cliff"];

/**
 * Owns the create-stream form's data handling: field values (persisted as a
 * draft), live validation, the review step, and the create / timeout-recovery
 * transactions. Presentation lives in CreateForm and CreateStreamFields.
 */
export function useCreateStreamForm(): CreateStreamForm {
  const wallet = useWallet();
  const { mismatch, walletNetwork, expectedNetwork } = useNetworkGuard();
  const router = useRouter();

  const [values, setValues] = useState<FormDraft>(() => readFormDraft() ?? EMPTY_FORM_DRAFT);
  const [errors, setErrors] = useState<CreateFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<TxStage | null>(null);
  const [timeoutHash, setTimeoutHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Non-null once the form has been validated and the user is on the review
  // step. Holds the exact parameters confirm will submit, so the review always
  // shows what will actually go on-chain.
  const [prepared, setPrepared] = useState<CreateStreamParams | null>(null);

  // Refs used to focus the first invalid field on submit
  const refs: CreateFormRefs = {
    recipient: useRef<HTMLInputElement>(null),
    token: useRef<HTMLInputElement>(null),
    amount: useRef<HTMLInputElement>(null),
    start: useRef<HTMLInputElement>(null),
    end: useRef<HTMLInputElement>(null),
    cliff: useRef<HTMLInputElement>(null),
  };

  const { recipient, token, amount, start, end, cliff } = values;

  function setFieldErrors(next: CreateFormErrors) {
    setErrors((prev) => ({ ...prev, ...next }));
  }

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
        setFieldErrors({ amount: amountFieldError(value) });
        break;
      case "start":
        setFieldErrors({
          start: value ? undefined : CREATE_STREAM_REQUIRED_MESSAGES.start,
          ...(value && end ? { end: endFieldError(value, end) } : {}),
          ...(value && cliff ? { cliff: cliffFieldError(value, end, cliff) } : {}),
        });
        break;
      case "end":
        if (!value) {
          setFieldErrors({ end: CREATE_STREAM_REQUIRED_MESSAGES.end });
          break;
        }
        setFieldErrors({
          end: endFieldError(start, value),
          ...(cliff ? { cliff: cliffFieldError(start, value, cliff) } : {}),
        });
        break;
      case "cliff":
        setFieldErrors({ cliff: value ? cliffFieldError(start, end, value) : undefined });
        break;
    }
  }

  const addressesValid =
    !!recipient && !!token && !recipientFieldError(recipient) && !tokenFieldError(token);

  // Live vesting-rate preview: only when amount and window are complete and
  // error-free, so an incomplete or invalid form never shows a rate.
  const previewRate =
    amount && start && end && !errors.amount && !errors.start && !errors.end
      ? vestingRatePerDay(parseAmount(amount), toUnix(start), toUnix(end))
      : null;

  // Live duration preview, only for a valid window; end-before-start already
  // flags the End field, so no misleading negative or zero span is shown.
  const previewDuration =
    start && end && !errors.start && !errors.end
      ? formatDuration(toUnix(end) - toUnix(start))
      : null;

  const hasUnsavedChanges =
    prepared !== null ||
    Object.values(values).some((value) => value.trim().length > 0);

  useFormNavigationWarning(hasUnsavedChanges && !submitting, "You have unsaved changes in this stream form. Leaving now will discard them.");
  useEffect(() => {
    const draft = { recipient, token, amount, start, end, cliff };
    const hasAnyValue = Object.values(draft).some((value) => value.trim().length > 0);

    if (!hasAnyValue) {
      clearFormDraft();
      return;
    }

    writeFormDraft(draft);
  }, [amount, cliff, end, recipient, start, token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !wallet.address) return;
    setError(null);

    if (mismatch) {
      setError(
        `Wrong network: wallet is on ${walletNetwork ?? "unknown"}, app expects ${expectedNetwork}. Switch networks in Freighter.`,
      );
      return;
    }

    // Re-run the shared rules at submit time so a stale live error can never
    // disagree with what is accepted for the transaction.
    const validationErrors = validateCreateStreamForm(values);
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
    setPrepared({
      sender: wallet.address,
      recipient,
      token,
      totalAmount: parseAmount(amount),
      startTime,
      endTime,
      cliffTime,
    });
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
        setError("Confirmation timed out again. Check explorer or try again later.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to confirm transaction.");
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
    previewRate,
    previewDuration,
    addressesValid,
    mismatch,
    submitting,
    stage,
    timeoutHash,
    error,
    prepared,
    handleSubmit,
    handleConfirm,
    handleRecoverTimeout,
    backToEdit: () => setPrepared(null),
  };
}
