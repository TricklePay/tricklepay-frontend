import { afterEach, describe, expect, it, vi } from "vitest";
import { formatAmount, timeRemaining, truncateAddress } from "@/lib/format";

describe("formatAmount", () => {
  it("formats whole amounts without a decimal point", () => {
    expect(formatAmount("0")).toBe("0");
    expect(formatAmount("10000000")).toBe("1");
    expect(formatAmount("1230000000")).toBe("123");
  });

  it("trims trailing zeros from the fraction", () => {
    expect(formatAmount("15000000")).toBe("1.5");
    expect(formatAmount("12500000")).toBe("1.25");
    expect(formatAmount("1200000")).toBe("0.12");
  });

  it("keeps significant zeros inside the fraction", () => {
    expect(formatAmount("10050000")).toBe("1.005");
    expect(formatAmount("10000001")).toBe("1.0000001");
  });

  it("pads sub-unit amounts to seven decimals", () => {
    expect(formatAmount("1")).toBe("0.0000001");
    expect(formatAmount("10")).toBe("0.000001");
    expect(formatAmount("9999999")).toBe("0.9999999");
  });

  it("formats the smallest and largest fractions of a unit", () => {
    expect(formatAmount("10000001")).toBe("1.0000001");
    expect(formatAmount("19999999")).toBe("1.9999999");
  });

  it("handles amounts beyond Number.MAX_SAFE_INTEGER without precision loss", () => {
    expect(formatAmount("123456789012345")).toBe("12345678.9012345");
    expect(formatAmount("170141183460469231731687303715884105727")).toBe(
      "17014118346046923173168730371588.4105727",
    );
  });

  it("throws on values that are not integers", () => {
    expect(() => formatAmount("1.5")).toThrow();
    expect(() => formatAmount("abc")).toThrow();
  });

  it("treats an empty string as zero, the way BigInt does", () => {
    expect(formatAmount("")).toBe("0");
  });
});

describe("truncateAddress", () => {
  it("keeps the first four and last four characters", () => {
    expect(truncateAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBe("GABC...4567");
  });

  it("truncates contract addresses the same way", () => {
    expect(truncateAddress("CABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBe("CABC...4567");
  });

  it("leaves short strings recognisable", () => {
    expect(truncateAddress("GABC1234")).toBe("GABC...1234");
  });
});

describe("timeRemaining", () => {
  const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
  const at = (offsetSeconds: number) => String(Math.floor(NOW / 1000) + offsetSeconds);

  function freeze() {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports days and hours when more than a day remains", () => {
    freeze();
    expect(timeRemaining(at(86400 * 2 + 3600 * 3))).toBe("ends in 2d 3h");
  });

  it("reports hours and minutes when less than a day remains", () => {
    freeze();
    expect(timeRemaining(at(3600 * 5 + 60 * 30))).toBe("ends in 5h 30m");
  });

  it("reports minutes only when less than an hour remains", () => {
    freeze();
    expect(timeRemaining(at(60 * 45))).toBe("ends in 45m");
  });

  it("collapses sub-minute remainders", () => {
    freeze();
    expect(timeRemaining(at(59))).toBe("ends in under a minute");
    expect(timeRemaining(at(1))).toBe("ends in under a minute");
  });

  it("reports ended at and after the end time", () => {
    freeze();
    expect(timeRemaining(at(0))).toBe("ended");
    expect(timeRemaining(at(-1))).toBe("ended");
    expect(timeRemaining(at(-86400 * 30))).toBe("ended");
  });

  it("omits the smaller unit when it is zero", () => {
    freeze();
    expect(timeRemaining(at(86400 * 3))).toBe("ends in 3d 0h");
    expect(timeRemaining(at(3600 * 2))).toBe("ends in 2h 0m");
  });
});
