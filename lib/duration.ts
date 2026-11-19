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
 * Whether a `datetime-local` start value names an instant already in the
 * past. The contract accepts a past start as long as end is still in the
 * future, and the elapsed portion vests — and becomes withdrawable —
 * immediately once the stream is created. Worth flagging to the sender, but
 * not an error: an empty or unparseable value is not "in the past", it is
 * just not a start yet.
 */
export function isStartInPast(start: string, now: Date = new Date()): boolean {
  if (!start) return false;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < now.getTime();
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
 * The largest unit that represents the span exactly always wins: an exact
 * number of years, then months, then weeks, falling back to whole days.
 * `preferredUnit` (the unit shown before the edit) is only a tie-breaker
 * between representations of the same span that are equally exact — today
 * that is days vs. weeks, so a span of 14 days stays "14 days" when the
 * previous unit was days and reads "2 weeks" otherwise. It never hides an
 * exact larger unit: going from 30 days to an end exactly one year later
 * shows "1 year", not "365 days".
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

  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  // Exact days match? Weeks are a fixed multiple of days, so a span that is
  // an exact number of weeks is equally exact in days: that is the one tie
  // the previous unit gets to break.
  const exactDays =
    diffDays > 0 && addDurationToLocal(start, String(diffDays), "days") === end;
  if (exactDays && preferredUnit === "days") {
    return { amount: String(diffDays), unit: "days" };
  }

  // Exact weeks match?
  if (
    diffDays > 0 &&
    diffDays % 7 === 0 &&
    addDurationToLocal(start, String(diffDays / 7), "weeks") === end
  ) {
    return { amount: String(diffDays / 7), unit: "weeks" };
  }

  // Fallback to days
  const days = Math.max(1, diffDays);
  return { amount: String(days), unit: "days" };
}

const DURATION_UNIT_SINGULAR: Record<DurationUnit, string> = {
  days: "day",
  weeks: "week",
  months: "month",
  years: "year",
};

function namedDuration(amount: string, unit: DurationUnit): string {
  const label = DURATION_UNIT_SINGULAR[unit];
  return `${amount} ${label}${amount === "1" ? "" : "s"}`;
}

const LONG_DURATION_YEARS = 10;

/**
 * Warns when `end` is more than LONG_DURATION_YEARS calendar years after
 * `start` — most often a mistyped year (2062 for 2026) that locks funds for
 * decades with no way out: the contract has no pause, and cancelling returns
 * the unvested part rather than letting it keep streaming on a corrected
 * date. Not an error — a stream genuinely can run that long — so this only
 * ever informs, never blocks.
 *
 * Calendar years (`setFullYear`), not a fixed day count, so a leap year
 * doesn't shift the threshold by a day. Returns null when start or end is
 * missing, unparseable, or end is not after start — the same conditions
 * `endFieldError` already covers, so this never doubles as a validator.
 */
export function longDurationWarning(start: string, end: string): string | null {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  if (endDate.getTime() <= startDate.getTime()) return null;

  const threshold = new Date(startDate);
  threshold.setFullYear(threshold.getFullYear() + LONG_DURATION_YEARS);
  if (endDate.getTime() <= threshold.getTime()) return null;

  const duration = deriveDuration(start, end);
  if (!duration) return null;

  return (
    `This stream will run for ${namedDuration(duration.amount, duration.unit)} — ` +
    "more than ten years. Double-check the end date."
  );
}
