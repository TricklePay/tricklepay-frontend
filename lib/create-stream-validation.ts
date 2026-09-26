import { isValidContractAddress, isValidStellarAddress, parseAmount, toUnix } from "@/lib/validation";
import type { FormDraft } from "@/types/form";

// Field-level validation for the create-stream form. Each rule returns the
// message to show under its field, or undefined when the value is fine (or not
// yet complete enough to judge). Pure, so they can be tested without React.

export type CreateStreamField = keyof FormDraft;
export type CreateStreamFieldErrors = Partial<Record<CreateStreamField, string>>;

// Keep required-field messages beside the rest of the form's rules. The form
// deliberately only shows these on submit (apart from date fields), while the
// other validators provide live feedback as a value is entered.
export const CREATE_STREAM_REQUIRED_MESSAGES: Partial<Record<CreateStreamField, string>> = {
  recipient: "Recipient address is required.",
  token: "Token contract id is required.",
  amount: "Amount is required.",
  start: "Start date is required.",
  end: "End date is required.",
};

export function requiredFieldError(
  field: CreateStreamField,
  value: string,
): string | undefined {
  return !value ? CREATE_STREAM_REQUIRED_MESSAGES[field] : undefined;
}

export function recipientFieldError(value: string): string | undefined {
  return value && !isValidStellarAddress(value)
    ? "Must be a valid G... or C... Stellar address."
    : undefined;
}

export function tokenFieldError(value: string): string | undefined {
  return value && !isValidContractAddress(value)
    ? "Must be a valid C... contract address."
    : undefined;
}

export function amountFieldError(value: string): string | undefined {
  if (!value) return undefined;
  try {
    return parseAmount(value) <= 0n ? "Amount must be greater than zero." : undefined;
  } catch (err) {
    return err instanceof Error ? err.message : "Invalid amount.";
  }
}

export function endFieldError(start: string, end: string): string | undefined {
  return start && end && toUnix(end) <= toUnix(start) ? "End must be after start." : undefined;
}

export function cliffFieldError(start: string, end: string, cliff: string): string | undefined {
  if (!start || !end || !cliff) return undefined;
  const c = toUnix(cliff);
  return c < toUnix(start) || c > toUnix(end)
    ? "Cliff must fall between start and end."
    : undefined;
}

/**
 * Validates every create-stream field for submission. Keeping this composition
 * here means the form has one source for both its live and submit-time rules.
 */
export function validateCreateStreamForm(values: FormDraft): CreateStreamFieldErrors {
  const { recipient, token, amount, start, end, cliff } = values;

  return {
    recipient: requiredFieldError("recipient", recipient) ?? recipientFieldError(recipient),
    token: requiredFieldError("token", token) ?? tokenFieldError(token),
    amount: requiredFieldError("amount", amount) ?? amountFieldError(amount),
    start: requiredFieldError("start", start),
    end: requiredFieldError("end", end) ?? endFieldError(start, end),
    cliff: cliffFieldError(start, end, cliff),
  };
}
