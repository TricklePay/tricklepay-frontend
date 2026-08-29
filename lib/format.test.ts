import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatAmount,
  formatDuration,
  formatTokenDisplay,
  relativeTime,
  timeRemaining,
  truncateAddress,
} from "@/lib/format";

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

describe("formatTokenDisplay", () => {
  it("returns the symbol for a known token contract", () => {
    expect(
      formatTokenDisplay("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"),
    ).toBe("USDC");
  });

  it("falls back to the truncated address for unknown contracts", () => {
    expect(formatTokenDisplay("CABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBe("CABC...4567");
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

describe("formatDuration", () => {
  it("formats known spans with the larger units first", () => {
    expect(formatDuration(60n)).toBe("1m");
    expect(formatDuration(3600n * 5n + 60n * 30n)).toBe("5h 30m");
    expect(formatDuration(86_400n * 2n + 3_600n * 3n)).toBe("2d 3h");
  });

  it("keeps a zero smaller unit for legibility", () => {
    expect(formatDuration(3600n * 2n)).toBe("2h 0m");
    expect(formatDuration(86_400n * 3n)).toBe("3d 0h");
  });

  it("collapses sub-minute spans", () => {
    expect(formatDuration(59n)).toBe("under a minute");
    expect(formatDuration(1n)).toBe("under a minute");
  });

  it("drops seconds from minute-and-above spans", () => {
    expect(formatDuration(100n)).toBe("1m");
    expect(formatDuration(3661n)).toBe("1h 1m");
    expect(formatDuration(90_000n)).toBe("1d 1h");
  });

  it("returns null for zero and negative spans", () => {
    expect(formatDuration(0n)).toBeNull();
    expect(formatDuration(-1n)).toBeNull();
    expect(formatDuration(-86_400n)).toBeNull();
  });
});

describe("relativeTime", () => {
  const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
  const at = (offsetSeconds: number) => String(Math.floor(NOW / 1000) + offsetSeconds);

  function freeze() {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns future countdown with the supplied verb", () => {
    freeze();
    expect(relativeTime(at(86400 * 2 + 3600 * 3), "starts")).toBe("starts in 2d 3h");
    expect(relativeTime(at(3600 * 5 + 60 * 30), "ends")).toBe("ends in 5h 30m");
    expect(relativeTime(at(60 * 45), "cliff")).toBe("cliff in 45m");
  });

  it("collapses sub-minute future spans", () => {
    freeze();
    expect(relativeTime(at(59), "starts")).toBe("starts in under a minute");
    expect(relativeTime(at(1), "cliff")).toBe("cliff in under a minute");
  });

  it("returns the past-tense form for ends and starts", () => {
    freeze();
    expect(relativeTime(at(0), "ends")).toBe("ended");
    expect(relativeTime(at(-1), "ends")).toBe("ended");
    expect(relativeTime(at(-100), "starts")).toBe("started");
  });

  it("returns a generic past form for other verbs", () => {
    freeze();
    expect(relativeTime(at(-1), "cliff")).toBe("cliff passed");
  });
});
