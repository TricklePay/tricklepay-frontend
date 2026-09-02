import { formatAmount } from "@/lib/format";


// Human decimal amounts are 7-decimal base units (the Stellar stroop
// standard), matching parseAmount in create-form.tsx and the contract's i128
// amounts.

const MAX_DECIMALS = 7;

// Parses a human decimal amount (e.g. "12.5") into 7-decimal base units.
// Throws a descriptive error for anything that is not a plain non-negative
// decimal with at most 7 fractional digits.
export function parseHumanAmount(human: string): bigint {
  const trimmed = human.trim();
  if (!trimmed) throw new Error("Enter an amount.");
  if (trimmed.startsWith("-")) throw new Error("Amount cannot be negative.");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a valid amount (e.g. 12.5).");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > MAX_DECIMALS) {
    throw new Error(`Amount cannot have more than ${MAX_DECIMALS} decimal places.`);
  }
  return BigInt(whole || "0") * 10_000_000n + BigInt(frac.padEnd(MAX_DECIMALS, "0"));
}

// Returns the message for the first problem with a requested withdrawal
// amount, or null when it is a valid partial amount of what is currently
// withdrawable. Pure display mapping over the same rules the submit path
// enforces, so inline hints can never disagree with submission.
export function withdrawalAmountError(human: string, withdrawable: bigint): string | null {
  let parsed: bigint;
  try {
    parsed = parseHumanAmount(human);
  } catch (err) {
    return err instanceof Error ? err.message : "Invalid amount.";
  }
  if (parsed <= 0n) return "Amount must be greater than zero.";
  if (parsed > withdrawable) {
    return `Amount exceeds withdrawable balance (${formatAmount(withdrawable.toString())}).`;
  }
  return null;
}
