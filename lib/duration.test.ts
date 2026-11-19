import { describe, expect, it } from "vitest";

import {
  addDurationToLocal,
  deriveDuration,
  DURATION_UNITS,
  durationFieldError,
  isDurationUnit,
  isStartInPast,
  longDurationWarning,
  nowAsDatetimeLocal,
} from "./duration";

describe("durationFieldError", () => {
  it("accepts an empty value — duration is optional", () => {
    expect(durationFieldError("")).toBeUndefined();
  });

  it("accepts a positive whole number", () => {
    expect(durationFieldError("30")).toBeUndefined();
    expect(durationFieldError("1")).toBeUndefined();
  });

  it("rejects zero", () => {
    expect(durationFieldError("0")).toBe("Duration must be greater than zero.");
  });

  it.each(["-5", "1.5", "abc", "1e3"])(
    "rejects %s as not a whole number",
    (value) => {
      expect(durationFieldError(value)).toBe("Duration must be a whole number (e.g. 30).");
    },
  );

  it("tolerates surrounding whitespace around an otherwise valid number", () => {
    expect(durationFieldError(" 30 ")).toBeUndefined();
  });
});

describe("isDurationUnit", () => {
  it("accepts every unit the form offers", () => {
    for (const unit of DURATION_UNITS) {
      expect(isDurationUnit(unit.value)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isDurationUnit("minutes")).toBe(false);
    expect(isDurationUnit("")).toBe(false);
  });
});

describe("addDurationToLocal", () => {
  const START = "2026-08-27T10:00";

  it("adds whole days", () => {
    expect(addDurationToLocal(START, "30", "days")).toBe("2026-09-26T10:00");
  });

  it("adds whole weeks as 7-day multiples", () => {
    expect(addDurationToLocal(START, "2", "weeks")).toBe("2026-09-10T10:00");
  });

  it("adds whole months with calendar arithmetic", () => {
    expect(addDurationToLocal(START, "1", "months")).toBe("2026-09-27T10:00");
  });

  it("adds whole years with calendar arithmetic", () => {
    expect(addDurationToLocal(START, "1", "years")).toBe("2027-08-27T10:00");
  });

  it("carries a month-end overflow the same way JS Date does, rather than clamping it", () => {
    // Jan 31 + 1 month has no Feb 31st, so it lands on Mar 3 (2027 is not a
    // leap year): this is JS Date's own setMonth behaviour, not a special
    // case added for duration.
    expect(addDurationToLocal("2027-01-31T09:00", "1", "months")).toBe("2027-03-03T09:00");
  });

  it("returns null when start is empty", () => {
    expect(addDurationToLocal("", "30", "days")).toBeNull();
  });

  it("returns null when the amount is invalid", () => {
    expect(addDurationToLocal(START, "0", "days")).toBeNull();
    expect(addDurationToLocal(START, "abc", "days")).toBeNull();
    expect(addDurationToLocal(START, "", "days")).toBeNull();
  });

  it("returns null when start does not parse as a date", () => {
    expect(addDurationToLocal("not-a-date", "30", "days")).toBeNull();
  });
});

describe("deriveDuration", () => {
  const START = "2026-08-27T10:00";

  it("derives exact days", () => {
    expect(deriveDuration(START, "2026-09-26T10:00")).toEqual({
      amount: "30",
      unit: "days",
    });
  });

  it("derives exact weeks when multiple of 7 days with weeks preferred", () => {
    expect(deriveDuration(START, "2026-09-10T10:00", "weeks")).toEqual({
      amount: "2",
      unit: "weeks",
    });
  });

  it("derives exact months", () => {
    expect(deriveDuration(START, "2026-09-27T10:00")).toEqual({
      amount: "1",
      unit: "months",
    });
  });

  it("derives exact years", () => {
    expect(deriveDuration(START, "2027-08-27T10:00")).toEqual({
      amount: "1",
      unit: "years",
    });
  });

  describe("with the previous unit as a preference", () => {
    it("switches from days to years when the end is exactly a year later", () => {
      expect(deriveDuration(START, "2027-08-27T10:00", "days")).toEqual({
        amount: "1",
        unit: "years",
      });
    });

    it("switches from days to months when the end is exactly some months later", () => {
      expect(deriveDuration(START, "2026-11-27T10:00", "days")).toEqual({
        amount: "3",
        unit: "months",
      });
    });

    it("switches from weeks to days when the span is no longer whole weeks", () => {
      expect(deriveDuration(START, "2026-09-06T10:00", "weeks")).toEqual({
        amount: "10",
        unit: "days",
      });
    });

    it("keeps days over weeks for a span that is exact in both", () => {
      expect(deriveDuration(START, "2026-09-03T10:00", "days")).toEqual({
        amount: "7",
        unit: "days",
      });
    });

    it("keeps weeks over days for a span that is exact in both", () => {
      expect(deriveDuration(START, "2026-09-03T10:00", "weeks")).toEqual({
        amount: "1",
        unit: "weeks",
      });
    });

    it("does not let a weeks preference hide an exact month", () => {
      // 2026-02-01 to 2026-03-01 is both 4 weeks and exactly 1 month.
      expect(deriveDuration("2026-02-01T10:00", "2026-03-01T10:00", "weeks")).toEqual({
        amount: "1",
        unit: "months",
      });
    });

    it("does not let a months preference hide an exact year", () => {
      expect(deriveDuration(START, "2027-08-27T10:00", "months")).toEqual({
        amount: "1",
        unit: "years",
      });
    });
  });

  it("returns null when end is equal to or before start", () => {
    expect(deriveDuration(START, START)).toBeNull();
    expect(deriveDuration(START, "2026-08-26T10:00")).toBeNull();
  });

  it("returns null when dates are empty or invalid", () => {
    expect(deriveDuration("", "2026-09-26T10:00")).toBeNull();
    expect(deriveDuration(START, "")).toBeNull();
    expect(deriveDuration("invalid", "2026-09-26T10:00")).toBeNull();
  });
});

describe("nowAsDatetimeLocal", () => {
  it("formats a given instant as a datetime-local value, truncated to the minute", () => {
    // 30 seconds and change past the minute — the seconds must not survive,
    // since a datetime-local value has no seconds component at all.
    expect(nowAsDatetimeLocal(new Date(2026, 7, 27, 10, 15, 32))).toBe("2026-08-27T10:15");
  });

  it("zero-pads single-digit month, day, hour, and minute", () => {
    expect(nowAsDatetimeLocal(new Date(2026, 0, 5, 9, 5, 0))).toBe("2026-01-05T09:05");
  });

  it("defaults to the current instant when none is given", () => {
    const before = nowAsDatetimeLocal();
    const now = new Date();
    const expected = nowAsDatetimeLocal(now);
    // Both calls land in the same clock minute in the overwhelming majority
    // of runs; allow either the same minute or the one right after it so the
    // test isn't flaky on the rare run that straddles a minute boundary.
    expect([expected, nowAsDatetimeLocal(new Date(now.getTime() + 60_000))]).toContain(before);
  });
});

describe("isStartInPast", () => {
  const now = new Date(2026, 7, 27, 12, 0, 0);

  it("is true for a start before now", () => {
    expect(isStartInPast("2026-08-26T12:00", now)).toBe(true);
  });

  it("is false for a start after now", () => {
    expect(isStartInPast("2026-08-28T12:00", now)).toBe(false);
  });

  it("is false for a start equal to now", () => {
    expect(isStartInPast(nowAsDatetimeLocal(now), now)).toBe(false);
  });

  it("is false for an empty value — nothing entered yet is not 'in the past'", () => {
    expect(isStartInPast("", now)).toBe(false);
  });

  it("is false for an unparseable value", () => {
    expect(isStartInPast("not-a-date", now)).toBe(false);
  });

  it("defaults to the current instant when none is given", () => {
    expect(isStartInPast("2020-01-01T00:00")).toBe(true);
  });
});

describe("longDurationWarning", () => {
  const START = "2026-08-27T10:00";

  it("is null at exactly ten years — the threshold itself is not 'more than'", () => {
    expect(longDurationWarning(START, "2036-08-27T10:00")).toBeNull();
  });

  it("warns one day past the ten-year threshold, naming the duration", () => {
    const warning = longDurationWarning(START, "2036-08-28T10:00");
    expect(warning).toMatch(/more than ten years/);
    expect(warning).toMatch(/\d+ (days?|weeks?)/);
  });

  it("names an exact-year span in years, not days — the mistyped-year case", () => {
    // Same month/day/time, only the year digit changed: exactly what someone
    // fat-fingering "2062" for "2026" would produce.
    expect(longDurationWarning(START, "2062-08-27T10:00")).toBe(
      "This stream will run for 36 years — more than ten years. Double-check the end date.",
    );
  });

  it("is null for a duration under ten years", () => {
    expect(longDurationWarning(START, "2030-08-27T10:00")).toBeNull();
  });

  it("is null when start or end is missing", () => {
    expect(longDurationWarning("", "2062-08-27T10:00")).toBeNull();
    expect(longDurationWarning(START, "")).toBeNull();
  });

  it("is null when end is not after start", () => {
    expect(longDurationWarning(START, START)).toBeNull();
    expect(longDurationWarning(START, "2020-01-01T00:00")).toBeNull();
  });

  it("is null for an unparseable value", () => {
    expect(longDurationWarning("not-a-date", "2062-08-27T10:00")).toBeNull();
    expect(longDurationWarning(START, "not-a-date")).toBeNull();
  });

  it("accounts for leap years rather than using a fixed day count", () => {
    // 2028 and 2032 are both leap years within this ten-year span, so a fixed
    // 3650-day threshold would fire a couple of days early.
    const tenCalendarYearsLater = "2036-08-27T10:00";
    expect(longDurationWarning(START, tenCalendarYearsLater)).toBeNull();
  });
});
