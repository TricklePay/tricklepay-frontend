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
function parseAmount(human: string): bigint {
  const [whole, frac = ""] = human.trim().split(".");
  const fracPadded = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * 10_000_000n + BigInt(fracPadded || "0");
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

  const [recipientError, setRecipientError] = useState<string | undefined>();
  const [tokenError, setTokenError] = useState<string | undefined>();

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

  const addressesValid =
    isValidStellarAddress(recipient) && isValidContractAddress(token);

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

    if (!recipient || !token || !amount || !start || !end) {
      setError("All fields except cliff are required.");
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
      setError("End must be after start.");
      return;
    }
    if (cliffTime < startTime || cliffTime > endTime) {
      setError("Cliff must fall between start and end.");
      return;
    }

    let totalAmount: bigint;
    try {
      totalAmount = parseAmount(amount);
    } catch {
      setError("Invalid amount.");
      return;
    }
    if (totalAmount <= 0n) {
      setError("Amount must be greater than zero.");
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
          className={tokenError ? inputErrorClass : inputClass}
          value={token}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder="C..."
          aria-invalid={!!tokenError}
          aria-describedby={tokenError ? "token-error" : undefined}
        />
      </Field>
      <Field label="Amount">
        <input
          className={inputClass}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          inputMode="decimal"
        />
      </Field>
      <Field label="Start">
        <input
          className={inputClass}
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </Field>
      <Field label="End">
        <input
          className={inputClass}
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </Field>
      <Field label="Cliff (optional)">
        <input
          className={inputClass}
          type="datetime-local"
          value={cliff}
          onChange={(e) => setCliff(e.target.value)}
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
