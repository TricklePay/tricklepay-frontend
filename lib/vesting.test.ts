import { describe, expect, it } from "vitest";
import { vestedAmount, vestingRatePerDay, withdrawableAmount } from "@/lib/vesting";

// A 100-token stream (7 decimals) running for 100 seconds, so one second of
// elapsed time vests exactly one token.
const TOTAL = 1_000_000_000n;
const START = 1_000n;
const END = 1_100n;
const PER_SECOND = TOTAL / (END - START);

describe("vestedAmount", () => {
  const vested = (now: bigint, cliff: bigint = START) =>
    vestedAmount(TOTAL, START, END, cliff, now);

  it("vests nothing before the start", () => {
    expect(vested(START - 1n)).toBe(0n);
    expect(vested(0n)).toBe(0n);
  });

  it("vests nothing at the start", () => {
    expect(vested(START)).toBe(0n);
  });

  it("vests linearly while streaming", () => {
    expect(vested(START + 1n)).toBe(PER_SECOND);
    expect(vested(START + 25n)).toBe(TOTAL / 4n);
    expect(vested(START + 50n)).toBe(TOTAL / 2n);
    expect(vested(START + 99n)).toBe(TOTAL - PER_SECOND);
  });

  it("vests the full amount at and after the end", () => {
    expect(vested(END)).toBe(TOTAL);
    expect(vested(END + 1n)).toBe(TOTAL);
    expect(vested(END + 1_000_000n)).toBe(TOTAL);
  });

  it("never exceeds the total", () => {
    for (let now = START; now <= END + 10n; now += 7n) {
      expect(vested(now)).toBeLessThanOrEqual(TOTAL);
    }
  });

  it("increases monotonically", () => {
    let previous = 0n;
    for (let now = START; now <= END; now += 1n) {
      const current = vested(now);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  describe("cliff", () => {
    const cliff = START + 30n;

    it("vests nothing before the cliff", () => {
      expect(vested(START + 29n, cliff)).toBe(0n);
    });

    it("releases the full elapsed amount once the cliff is reached", () => {
      expect(vested(cliff, cliff)).toBe(PER_SECOND * 30n);
    });

    it("continues linearly after the cliff", () => {
      expect(vested(START + 50n, cliff)).toBe(TOTAL / 2n);
    });

    it("still pays out in full after the end", () => {
      expect(vested(END, cliff)).toBe(TOTAL);
    });

    it("treats a cliff at the end as all-or-nothing", () => {
      expect(vested(END - 1n, END)).toBe(0n);
      expect(vested(END, END)).toBe(TOTAL);
    });
  });

  describe("integer math", () => {
    it("truncates rather than rounds", () => {
      // 10 base units over 3 seconds: 1 second in, 10/3 truncates to 3.
      expect(vestedAmount(10n, 0n, 3n, 0n, 1n)).toBe(3n);
      expect(vestedAmount(10n, 0n, 3n, 0n, 2n)).toBe(6n);
      expect(vestedAmount(10n, 0n, 3n, 0n, 3n)).toBe(10n);
    });

    it("handles a zero-length stream without dividing by zero", () => {
      expect(vestedAmount(TOTAL, START, START, START, START)).toBe(TOTAL);
      expect(vestedAmount(TOTAL, START, START, START, START - 1n)).toBe(0n);
    });

    it("handles a zero total", () => {
      expect(vestedAmount(0n, START, END, START, START + 50n)).toBe(0n);
    });

    it("handles amounts beyond Number.MAX_SAFE_INTEGER", () => {
      const huge = 2n ** 90n;
      expect(vestedAmount(huge, 0n, 100n, 0n, 50n)).toBe(huge / 2n);
    });
  });
});

describe("withdrawableAmount", () => {
  it("returns what has vested but not yet been withdrawn", () => {
    expect(withdrawableAmount(100n, 40n)).toBe(60n);
  });

  it("returns zero when everything vested has been withdrawn", () => {
    expect(withdrawableAmount(100n, 100n)).toBe(0n);
  });

  it("clamps to zero when withdrawn exceeds vested", () => {
    expect(withdrawableAmount(100n, 150n)).toBe(0n);
  });

  it("returns the full amount when nothing has been withdrawn", () => {
    expect(withdrawableAmount(100n, 0n)).toBe(100n);
  });

  it("is never negative", () => {
    expect(withdrawableAmount(0n, 0n)).toBe(0n);
    expect(withdrawableAmount(0n, 1n)).toBe(0n);
  });
});

describe("vestingRatePerDay", () => {
  it("computes the daily rate for a known window", () => {
    // 100 tokens over exactly 100 seconds: a day holds 864 such windows, so
    // 864 * 100 tokens stream per day.
    expect(vestingRatePerDay(1_000_000_000n, 1_000n, 1_100n)).toBe(864_000_000_000n);
  });

  it("scales linearly with the amount", () => {
    const base = vestingRatePerDay(1_000_000_000n, 0n, 86_400n);
    expect(base).toBe(1_000_000_000n);
    expect(vestingRatePerDay(2_000_000_000n, 0n, 86_400n)).toBe(base! * 2n);
  });

  it("falls as the duration grows", () => {
    const day = vestingRatePerDay(1_000_000_000n, 0n, 86_400n);
    const week = vestingRatePerDay(1_000_000_000n, 0n, 86_400n * 7n);
    expect(day).toBe(1_000_000_000n);
    expect(week).toBe((1_000_000_000n) / 7n);
    expect(week!).toBeLessThan(day!);
  });

  it("truncates like integer math instead of rounding", () => {
    // 1 stroop over a 3-second window: (1 * 86400) / 3 divides evenly.
    expect(vestingRatePerDay(1n, 0n, 3n)).toBe(28_800n);
    // An uneven window truncates rather than rounds.
    expect(vestingRatePerDay(10n, 0n, 86_401n)).toBe((10n * 86_400n) / 86_401n);
  });

  it("returns null for incomplete or inverted windows", () => {
    expect(vestingRatePerDay(1_000n, 5_000n, 5_000n)).toBeNull();
    expect(vestingRatePerDay(1_000n, 6_000n, 5_000n)).toBeNull();
    expect(vestingRatePerDay(0n, 0n, 86_400n)).toBeNull();
  });

  it("stays exact far beyond Number.MAX_SAFE_INTEGER", () => {
    const huge = 2n ** 100n;
    // A one-day window streams everything in a day.
    expect(vestingRatePerDay(huge, 0n, 86_400n)).toBe(huge);
  });
});
