// A shortcut for the create-stream form's Start/End window: instead of
// working out an end date by hand, enter a whole number and a unit ("30" +
// "Days") and the end field fills itself in from the start. Pure functions,
// so they can be tested without React — see lib/create-stream-validation.ts
// for the same convention on the form's other rules.

export type DurationUnit = "days" | "weeks" | "months" | "years";

export const DURATION_UNITS: ReadonlyArray<{ value: DurationUnit; label: string }> = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

export function isDurationUnit(value: string): value is DurationUnit {
  return DURATION_UNITS.some((unit) => unit.value === value);
}

/**
 * Validates a typed duration amount. Whole numbers only — a fractional month
 * or year has no single correct meaning in calendar arithmetic (how many days
 * is "1.5 months"?), so the form asks for a whole number across every unit
 * rather than allowing fractions for some and not others.
 */
export function durationFieldError(amount: string): string | undefined {
  if (!amount) return undefined;
  const trimmed = amount.trim();
  if (!/^\d+$/.test(trimmed)) {
    return "Duration must be a whole number (e.g. 30).";
  }
  if (BigInt(trimmed) <= 0n) {
    return "Duration must be greater than zero.";
  }
  return undefined;
}

// Formats a Date in local wall-clock time as a `datetime-local` input expects
// ("YYYY-MM-DDTHH:mm") — the inverse of `new Date(local)`, which is how
// toUnix() and the browser itself read that value.
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * The current instant as a `datetime-local` value, in local wall-clock
 * time — what the field would default to if a browser filled in "now" for
 * you. Used by lib/schedule-presets.ts when a preset is applied before a
 * start time has been entered. Takes the instant to format (defaulting to
 * `new Date()`) so a caller can pin it for a deterministic test.
 */
export function nowAsDatetimeLocal(now: Date = new Date()): string {
  return toDatetimeLocalValue(now);
}

/**
 * Adds a duration to a `datetime-local` start value and returns the resulting
 * `datetime-local` string, or `null` if `start` or `amount` don't parse (an
 * incomplete form, not a user-facing error — `durationFieldError` covers
 * that).
 *
 * Months and years use calendar arithmetic (`setMonth`/`setFullYear`), which
 * is what someone means by "1 month from now" — not a fixed 30-day
 * approximation. That inherits JS Date's own day-overflow behaviour (adding 1
 * month to Jan 31 lands on Mar 3, since February has no 31st); this function
 * does not special-case it.
 */
export function addDurationToLocal(
  start: string,
  amount: string,
  unit: DurationUnit,
): string | null {
  // An empty amount is a valid (optional) field value, not an error — but
  // there's nothing to add, so it still can't compute an end time.
  if (!start || !amount || durationFieldError(amount)) return null;

  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return null;

  const n = Number(amount.trim());
  switch (unit) {
    case "days":
      date.setDate(date.getDate() + n);
      break;
    case "weeks":
      date.setDate(date.getDate() + n * 7);
      break;
    case "months":
      date.setMonth(date.getMonth() + n);
      break;
    case "years":
      date.setFullYear(date.getFullYear() + n);
      break;
  }

  return toDatetimeLocalValue(date);
}

/**
 * Derives a duration amount and unit from a `datetime-local` start and end window.
 * Used when the user edits `end` directly so the displayed duration updates and
 * stays in sync with `end`.
 *
 * Checks for exact year, month, or week matches first (honoring `preferredUnit`
 * when it matches the span), and falls back to whole days.
 *
 * Returns `null` if either date does not parse, or if `end <= start`.
 */
export function deriveDuration(
  start: string,
  end: string,
  preferredUnit?: string,
): { amount: string; unit: DurationUnit } | null {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) return null;

  // Check if preferredUnit matches exactly
  // Exact years match?
  const y = endDate.getFullYear() - startDate.getFullYear();
  if (y > 0 && addDurationToLocal(start, String(y), "years") === end) {
    return { amount: String(y), unit: "years" };
  }

  // Exact months match?
  const m =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  if (m > 0 && addDurationToLocal(start, String(m), "months") === end) {
    return { amount: String(m), unit: "months" };
  }

  if (preferredUnit && isDurationUnit(preferredUnit)) {
    if (preferredUnit === "years" && y > 0 && addDurationToLocal(start, String(y), "years") === end) {
      return { amount: String(y), unit: "years" };
    }
    if (preferredUnit === "months" && m > 0 && addDurationToLocal(start, String(m), "months") === end) {
      return { amount: String(m), unit: "months" };
    }
    if (preferredUnit === "weeks") {
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      if (
        diffDays > 0 &&
        diffDays % 7 === 0 &&
        addDurationToLocal(start, String(diffDays / 7), "weeks") === end
      ) {
        return { amount: String(diffDays / 7), unit: "weeks" };
      }
    } else if (preferredUnit === "days") {
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      if (diffDays > 0 && addDurationToLocal(start, String(diffDays), "days") === end) {
        return { amount: String(diffDays), unit: "days" };
      }
    }
  }

  // Exact weeks match?
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (
    diffDays > 0 &&
    diffDays % 7 === 0 &&
    addDurationToLocal(start, String(diffDays / 7), "weeks") === end
  ) {
    return { amount: String(diffDays / 7), unit: "weeks" };
  }

  // Fallback to days
  const days = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
  return { amount: String(days), unit: "days" };
}
