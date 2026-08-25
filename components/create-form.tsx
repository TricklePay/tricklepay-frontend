"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { StrKey } from "@stellar/stellar-sdk";
import { useWallet } from "@/components/wallet-provider";
import { useNetworkGuard } from "@/hooks/use-network-guard";
import { createStream } from "@/lib/contract";

// A Stellar address is valid if it is a public key (G...) or a contract (C...).
function isValidStellarAddress(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value);
}

// A token contract id must be a contract address only (C...).
function isValidContractAddress(value: string): boolean {
  return StrKey.isValidContract(value);
}

// Converts a `datetime-local` value to Unix seconds.
function toUnix(local: string): bigint {
  return BigInt(Math.floor(new Date(local).getTime() / 1000));
}

// Parses a human decimal amount into 7-decimal base units.
// Throws a descriptive error for any input that is not a non-negative decimal
// with at most 7 fractional digits (e.g. "1e5", "1.2.3", "-5", "1.12345678"
// are all rejected before BigInt conversion is attempted).
function parseAmount(human: string): bigint {
  const trimmed = human.trim();

  // Reject scientific notation, negatives, multiple dots, and anything else
  // that isn't a plain non-negative decimal.
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Amount must be a positive number (e.g. 100 or 1.5).");
  }

  const [whole, frac = ""] = trimmed.split(".");

  // Reject more than 7 decimal places explicitly rather than silently truncating.
  if (frac.length > 7) {
    throw new Error("Amount cannot have more than 7 decimal places.");
  }

  const fracPadded = frac.padEnd(7, "0");
  return BigInt(whole) * 10_000_000n + BigInt(fracPadded);
}

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
  "rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

const inputErrorClass =
  "rounded border border-red-500 bg-neutral-900 px-3 py-2 text-sm focus:border-red-400 focus:outline-none";

export function CreateForm() {
  const wallet = useWallet();
  const { mismatch, walletNetwork, expectedNetwork } = useNetworkGuard();
  const router = useRouter();

  const [recipient, setRecipient] = useState("");
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [cliff, setCliff] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field-level errors
  const [recipientError, setRecipientError] = useState<string | undefined>();
  const [tokenError, setTokenError] = useState<string | undefined>();
  const [amountError, setAmountError] = useState<string | undefined>();
  const [startError, setStartError] = useState<string | undefined>();
  const [endError, setEndError] = useState<string | undefined>();
  const [cliffError, setCliffError] = useState<string | undefined>();

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

  const hasFieldErrors = !!(
    recipientError ||
    tokenError ||
    amountError ||
    startError ||
    endError ||
    cliffError
  );

  if (!wallet.address) {
    return <p className="text-sm text-neutral-400">Connect your wallet to create a stream.</p>;
  }
  const sender = wallet.address;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mismatch) {
      setError(
        `Wrong network: wallet is on ${walletNetwork ?? "unknown"}, app expects ${expectedNetwork}. Switch networks in Freighter.`,
      );
      return;
    }

    // Trigger field-level errors for any blank required fields
    let hasErrors = false;
    if (!recipient) { setRecipientError("Recipient address is required."); hasErrors = true; }
    if (!token) { setTokenError("Token contract id is required."); hasErrors = true; }
    if (!amount) { setAmountError("Amount is required."); hasErrors = true; }
    if (!start) { setStartError("Start date is required."); hasErrors = true; }
    if (!end) { setEndError("End date is required."); hasErrors = true; }
    if (hasErrors || hasFieldErrors) return;

    if (!addressesValid) {
      setError("Fix address errors before submitting.");
      return;
    }

    const startTime = toUnix(start);
    const endTime = toUnix(end);
    const cliffTime = cliff ? toUnix(cliff) : startTime;

    if (endTime <= startTime) {
      setEndError("End must be after start.");
      return;
    }
    if (cliffTime < startTime || cliffTime > endTime) {
      setCliffError("Cliff must fall between start and end.");
      return;
    }

    let totalAmount: bigint;
    try {
      totalAmount = parseAmount(amount);
    } catch (err) {
      setAmountError(err instanceof Error ? err.message : "Invalid amount.");
      return;
    }
    if (totalAmount <= 0n) {
      setAmountError("Amount must be greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      await createStream({ sender, recipient, token, totalAmount, startTime, endTime, cliffTime });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stream.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Recipient address" error={recipientError}>
        <input
          id="field-recipient"
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
      <Field label="Start" error={startError}>
        <input
          id="field-start"
          className={startError ? inputErrorClass : inputClass}
          type="datetime-local"
          value={start}
          onChange={(e) => handleStartChange(e.target.value)}
          aria-invalid={!!startError}
          aria-describedby={startError ? "start-error" : undefined}
        />
      </Field>
      <Field label="End" error={endError}>
        <input
          id="field-end"
          className={endError ? inputErrorClass : inputClass}
          type="datetime-local"
          value={end}
          onChange={(e) => handleEndChange(e.target.value)}
          aria-invalid={!!endError}
          aria-describedby={endError ? "end-error" : undefined}
        />
      </Field>
      <Field label="Cliff (optional)" error={cliffError}>
        <input
          id="field-cliff"
          className={cliffError ? inputErrorClass : inputClass}
          type="datetime-local"
          value={cliff}
          onChange={(e) => handleCliffChange(e.target.value)}
          aria-invalid={!!cliffError}
          aria-describedby={cliffError ? "cliff-error" : undefined}
        />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || mismatch || !addressesValid}
        className="mt-2 rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create stream"}
      </button>
    </form>
  );
}
