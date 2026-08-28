"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet-provider";
import { TransactionProgress } from "@/components/transaction-progress";
import { useNetworkGuard } from "@/hooks/use-network-guard";
import { createStream, confirmTransaction, TransactionTimeoutError, type CreateStreamParams, type TxStage } from "@/lib/contract";
import { setPendingNotice } from "@/lib/pending-notice";
import { config } from "@/lib/config";
import { txExplorerUrl } from "@/lib/explorer";
import { StreamReview } from "@/components/stream-review";
import { vestingRatePerDay } from "@/lib/vesting";
import { formatAmount, formatDuration } from "@/lib/format";
import {
  isValidStellarAddress,
  isValidContractAddress,
  toUnix,
  parseAmount,
} from "@/lib/validation";
import { formatUtcFromLocalInput, resolvedTimeZoneLabel } from "@/lib/timezone";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-400">{label}</span>
      {children}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}

const inputClass =
  "rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-500";

const inputErrorClass =
  "rounded border border-red-500 bg-neutral-900 px-3 py-2 text-sm focus:border-red-400";

const FORM_DRAFT_STORAGE_KEY = "tricklepay-create-form-draft";

type FormDraft = {
  recipient: string;
  token: string;
  amount: string;
  start: string;
  end: string;
  cliff: string;
};

function readFormDraft(): FormDraft | null {
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

function writeFormDraft(values: FormDraft) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(FORM_DRAFT_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Ignore storage failures from private browsing or quota limits.
  }
}

function clearFormDraft() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(FORM_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage failures from private browsing or quota limits.
  }
}

export function CreateForm() {
  const wallet = useWallet();
  const { mismatch, walletNetwork, expectedNetwork } = useNetworkGuard();
  const router = useRouter();

  const draft = readFormDraft();
  const [recipient, setRecipient] = useState(draft?.recipient ?? "");
  const [token, setToken] = useState(draft?.token ?? "");
  const [amount, setAmount] = useState(draft?.amount ?? "");
  const [start, setStart] = useState(draft?.start ?? "");
  const [end, setEnd] = useState(draft?.end ?? "");
  const [cliff, setCliff] = useState(draft?.cliff ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<TxStage | null>(null);
  const [timeoutHash, setTimeoutHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Non-null once the form has been validated and the user is on the review
  // step. Holds the exact parameters confirm will submit, so the review always
  // shows what will actually go on-chain.
  const [prepared, setPrepared] = useState<CreateStreamParams | null>(null);

  // Field-level errors
  const [recipientError, setRecipientError] = useState<string | undefined>();
  const [tokenError, setTokenError] = useState<string | undefined>();
  const [amountError, setAmountError] = useState<string | undefined>();
  const [startError, setStartError] = useState<string | undefined>();
  const [endError, setEndError] = useState<string | undefined>();
  const [cliffError, setCliffError] = useState<string | undefined>();

  // Refs used to focus the first invalid field on submit
  const recipientRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const cliffRef = useRef<HTMLInputElement>(null);

  function handleRecipientChange(value: string) {
    setRecipient(value);
    if (value && !isValidStellarAddress(value)) {
      setRecipientError("Must be a valid G... or C... Stellar address.");
    } else {
      setRecipientError(undefined);
    }
  }

  function handleTokenChange(value: string) {
    setToken(value);
    if (value && !isValidContractAddress(value)) {
      setTokenError("Must be a valid C... contract address.");
    } else {
      setTokenError(undefined);
    }
  }

  function handleAmountChange(value: string) {
    setAmount(value);
    if (!value) {
      setAmountError(undefined);
      return;
    }
    try {
      const parsed = parseAmount(value);
      if (parsed <= 0n) {
        setAmountError("Amount must be greater than zero.");
      } else {
        setAmountError(undefined);
      }
    } catch (err) {
      setAmountError(err instanceof Error ? err.message : "Invalid amount.");
    }
  }

  function handleStartChange(value: string) {
    setStart(value);
    setStartError(value ? undefined : "Start date is required.");
    // Re-validate end and cliff against the new start
    if (value && end) validateEndAgainstStart(value, end);
    if (value && cliff) validateCliff(value, end, cliff);
  }

  function handleEndChange(value: string) {
    setEnd(value);
    if (!value) {
      setEndError("End date is required.");
      return;
    }
    validateEndAgainstStart(start, value);
    if (cliff) validateCliff(start, value, cliff);
  }

  function handleCliffChange(value: string) {
    setCliff(value);
    if (value) validateCliff(start, end, value);
    else setCliffError(undefined);
  }

  function validateEndAgainstStart(startVal: string, endVal: string) {
    if (startVal && endVal && toUnix(endVal) <= toUnix(startVal)) {
      setEndError("End must be after start.");
    } else {
      setEndError(undefined);
    }
  }

  function validateCliff(startVal: string, endVal: string, cliffVal: string) {
    if (!startVal || !endVal || !cliffVal) {
      setCliffError(undefined);
      return;
    }
    const s = toUnix(startVal);
    const e = toUnix(endVal);
    const c = toUnix(cliffVal);
    if (c < s || c > e) {
      setCliffError("Cliff must fall between start and end.");
    } else {
      setCliffError(undefined);
    }
  }

  const addressesValid =
    isValidStellarAddress(recipient) && isValidContractAddress(token);

  // Live vesting-rate preview: only when amount and window are complete and
  // error-free, so an incomplete or invalid form never shows a rate.
  const previewRate =
    amount && start && end && !amountError && !startError && !endError
      ? vestingRatePerDay(parseAmount(amount), toUnix(start), toUnix(end))
      : null;

  // Live duration preview, only for a valid window; end-before-start already
  // flags the End field, so no misleading negative or zero span is shown.
  const previewDuration =
    start && end && !startError && !endError
      ? formatDuration(toUnix(end) - toUnix(start))
      : null;

  const hasFieldErrors = !!(
    recipientError ||
    tokenError ||
    amountError ||
    startError ||
    endError ||
    cliffError
  );

  useEffect(() => {
    const values = { recipient, token, amount, start, end, cliff };
    const hasAnyValue = Object.values(values).some((value) => value.trim().length > 0);

    if (!hasAnyValue) {
      clearFormDraft();
      return;
    }

    writeFormDraft(values);
  }, [amount, cliff, end, recipient, start, token]);

  if (!wallet.address) {
    return <p className="text-sm text-neutral-400">Connect your wallet to create a stream.</p>;
  }
  const sender = wallet.address;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (mismatch) {
      setError(
        `Wrong network: wallet is on ${walletNetwork ?? "unknown"}, app expects ${expectedNetwork}. Switch networks in Freighter.`,
      );
      return;
    }

    // Trigger field-level errors for any blank required fields, then focus the first invalid one.
    let hasErrors = false;
    if (!recipient) { setRecipientError("Recipient address is required."); hasErrors = true; }
    if (!token) { setTokenError("Token contract id is required."); hasErrors = true; }
    if (!amount) { setAmountError("Amount is required."); hasErrors = true; }
    if (!start) { setStartError("Start date is required."); hasErrors = true; }
    if (!end) { setEndError("End date is required."); hasErrors = true; }

    if (hasErrors || hasFieldErrors) {
      // Focus the first field that already has (or just received) an error.
      const firstInvalid = [
        { error: recipientError || (!recipient ? "x" : undefined), ref: recipientRef },
        { error: tokenError     || (!token     ? "x" : undefined), ref: tokenRef },
        { error: amountError    || (!amount    ? "x" : undefined), ref: amountRef },
        { error: startError     || (!start     ? "x" : undefined), ref: startRef },
        { error: endError       || (!end       ? "x" : undefined), ref: endRef },
        { error: cliffError,                                        ref: cliffRef },
      ].find((f) => !!f.error);
      firstInvalid?.ref.current?.focus();
      return;
    }

    if (!addressesValid) {
      setError("Fix address errors before submitting.");
      return;
    }

    const startTime = toUnix(start);
    const endTime = toUnix(end);
    const cliffTime = cliff ? toUnix(cliff) : startTime;

    if (endTime <= startTime) {
      setEndError("End must be after start.");
      endRef.current?.focus();
      return;
    }
    if (cliffTime < startTime || cliffTime > endTime) {
      setCliffError("Cliff must fall between start and end.");
      cliffRef.current?.focus();
      return;
    }

    let totalAmount: bigint;
    try {
      totalAmount = parseAmount(amount);
    } catch (err) {
      setAmountError(err instanceof Error ? err.message : "Invalid amount.");
      amountRef.current?.focus();
      return;
    }
    if (totalAmount <= 0n) {
      setAmountError("Amount must be greater than zero.");
      amountRef.current?.focus();
      return;
    }

    // Validation passed: show the review step. The transaction itself only
    // goes out once the user confirms there.
    setPrepared({
      sender,
      recipient,
      token,
      totalAmount,
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
      const hash = await createStream(
        prepared,
        (s) => setStage(s),
      );
      setPendingNotice({ message: "Stream created.", hash });
      setTimeoutHash(null);
      clearFormDraft();
      router.push("/");
    } catch (err) {
      if (err instanceof TransactionTimeoutError) {
        setTimeoutHash(err.txHash);
        setError("Confirmation timed out. The transaction was submitted to the network.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to create stream.");
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

  // Transaction feedback shared by both phases so progress, timeout recovery,
  // and errors stay visible whether the user is on the form or the review.
  const feedback = (
    <>
      <TransactionProgress stage={stage} />

      {timeoutHash && (
        <div
          role="alert"
          className="my-2 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200"
        >
          <p className="font-semibold">Transaction confirmation timed out</p>
          <p className="mt-1 text-neutral-400">
            The transaction was submitted on-chain. You can re-check its status without re-submitting.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleRecoverTimeout()}
              disabled={submitting}
              className="rounded bg-amber-400 px-2.5 py-1 font-semibold text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
            >
              Re-check status
            </button>
            <a
              href={txExplorerUrl(timeoutHash, config.network)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 underline hover:text-amber-100"
            >
              View on Stellar Expert
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </>
  );

  if (prepared) {
    return (
      <div className="flex flex-col gap-4">
        <StreamReview
          params={prepared}
          submitting={submitting}
          onBack={() => setPrepared(null)}
          onConfirm={() => void handleConfirm()}
        />
        {feedback}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Recipient address" error={recipientError}>
        <input
          id="field-recipient"
          ref={recipientRef}
          className={recipientError ? inputErrorClass : inputClass}
          value={recipient}
          onChange={(e) => handleRecipientChange(e.target.value)}
          placeholder="G... or C..."
          aria-invalid={!!recipientError}
          aria-describedby={recipientError ? "recipient-error" : undefined}
        />
      </Field>
      <Field label="Token contract id" error={tokenError}>
        <input
          id="field-token"
          ref={tokenRef}
          className={tokenError ? inputErrorClass : inputClass}
          value={token}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder="C..."
          aria-invalid={!!tokenError}
          aria-describedby={tokenError ? "token-error" : undefined}
        />
      </Field>
      <Field label="Amount" error={amountError}>
        <input
          id="field-amount"
          ref={amountRef}
          className={amountError ? inputErrorClass : inputClass}
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="100"
          inputMode="decimal"
          aria-invalid={!!amountError}
          aria-describedby={amountError ? "amount-error" : "amount-hint"}
        />
        {!amountError && (
          <span id="amount-hint" className="text-xs text-neutral-500">
            Up to 7 decimal places (e.g. 1.0000001)
          </span>
        )}
      </Field>
      <p className="text-xs text-neutral-500">
        Start, end, and cliff below use your local timezone —{" "}
        <span className="text-neutral-400">{resolvedTimeZoneLabel()}</span>.
      </p>

      <Field label="Start" error={startError}>
        <input
          id="field-start"
          ref={startRef}
          className={startError ? inputErrorClass : inputClass}
          type="datetime-local"
          value={start}
          onChange={(e) => handleStartChange(e.target.value)}
          aria-invalid={!!startError}
          aria-describedby={
            startError ? "start-error" : formatUtcFromLocalInput(start) ? "start-utc" : undefined
          }
        />
        {!startError && formatUtcFromLocalInput(start) && (
          <span id="start-utc" className="text-xs text-neutral-500">
            {formatUtcFromLocalInput(start)}
          </span>
        )}
      </Field>
      <Field label="End" error={endError}>
        <input
          id="field-end"
          ref={endRef}
          className={endError ? inputErrorClass : inputClass}
          type="datetime-local"
          value={end}
          onChange={(e) => handleEndChange(e.target.value)}
          aria-invalid={!!endError}
          aria-describedby={
            endError ? "end-error" : formatUtcFromLocalInput(end) ? "end-utc" : undefined
          }
        />
        {!endError && formatUtcFromLocalInput(end) && (
          <span id="end-utc" className="text-xs text-neutral-500">
            {formatUtcFromLocalInput(end)}
          </span>
        )}
      </Field>

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

      <Field label="Cliff (optional)" error={cliffError}>
        <input
          id="field-cliff"
          ref={cliffRef}
          className={cliffError ? inputErrorClass : inputClass}
          type="datetime-local"
          value={cliff}
          onChange={(e) => handleCliffChange(e.target.value)}
          aria-invalid={!!cliffError}
          aria-describedby={
            cliffError ? "cliff-error" : formatUtcFromLocalInput(cliff) ? "cliff-utc" : undefined
          }
        />
        {!cliffError && formatUtcFromLocalInput(cliff) && (
          <span id="cliff-utc" className="text-xs text-neutral-500">
            {formatUtcFromLocalInput(cliff)}
          </span>
        )}
      </Field>

      {feedback}

      <button
        type="submit"
        disabled={submitting || mismatch || !addressesValid}
        className="mt-2 rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Review stream"}
      </button>
    </form>
  );
}
