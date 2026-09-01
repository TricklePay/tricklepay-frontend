import { StrKey } from "@stellar/stellar-sdk";
import { MS_PER_SECOND } from "@/lib/constants";

/**
 * A Stellar address is valid if it is a public key (G...) or a contract (C...).
 */
export function isValidStellarAddress(value: string): boolean {
  if (!value) return false;
  return StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value);
}

/**
 * A token contract ID must be a contract address only (C...).
 */
export function isValidContractAddress(value: string): boolean {
  if (!value) return false;
  return StrKey.isValidContract(value);
}

/**
 * Converts a `datetime-local` input string to Unix timestamp in seconds.
 */
export function toUnix(local: string): bigint {
  const time = new Date(local).getTime();
  if (isNaN(time)) {
    throw new Error("Invalid date input.");
  }
  return BigInt(Math.floor(time / MS_PER_SECOND));
}

/**
 * Parses a human decimal amount into 7-decimal base units (bigint).
 * Rejects non-positive numbers, scientific notation, negative numbers,
 * multiple decimal points, and amounts with more than 7 decimal places.
 */
export function parseAmount(human: string): bigint {
  const trimmed = human.trim();

  if (!trimmed) {
    throw new Error("Amount is required.");
  }

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
  const result = BigInt(whole) * 10_000_000n + BigInt(fracPadded);

  if (result <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  return result;
}

export interface StreamDateValidationResult {
  endError?: string;
  cliffError?: string;
}

/**
 * Validates start, end, and optional cliff date strings.
 */
export function validateStreamDates(
  startVal: string,
  endVal: string,
  cliffVal?: string,
): StreamDateValidationResult {
  const result: StreamDateValidationResult = {};

  if (startVal && endVal) {
    try {
      const s = toUnix(startVal);
      const e = toUnix(endVal);
      if (e <= s) {
        result.endError = "End must be after start.";
      }
    } catch {
      result.endError = "Invalid start or end date.";
    }
  }

  if (startVal && endVal && cliffVal) {
    try {
      const s = toUnix(startVal);
      const e = toUnix(endVal);
      const c = toUnix(cliffVal);
      if (c < s || c > e) {
        result.cliffError = "Cliff must fall between start and end.";
      }
    } catch {
      result.cliffError = "Invalid cliff date.";
    }
  }

  return result;
}
