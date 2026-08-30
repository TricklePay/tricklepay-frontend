import { describe, it, expect, vi, afterEach } from "vitest";
import type { StreamView } from "@/types/stream";
import { vestedAmount, withdrawableAmount } from "@/lib/vesting";

// We test the accrual computation logic directly — the same path useAccrual
// takes — without mounting React. This keeps the suite fast and avoids a
// jsdom dependency while still exercising the ceiling behaviour.

const BASE_STREAM: StreamView = {
  id: "1",
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: "USDC",
  totalAmount: "1000000000", // 100 tokens at 7 decimals
  withdrawn: "0",
  vested: "0",
  withdrawable: "0",
  locked: "1000000000",
  startTime: "1000",
  endTime: "1100",
  cliffTime: "1000",
  cancelled: false,
  status: "streaming",
  progress: 0,
};

const TOTAL = BigInt(BASE_STREAM.totalAmount);
const START = BigInt(BASE_STREAM.startTime);
const END = BigInt(BASE_STREAM.endTime);
const CLIFF = BigInt(BASE_STREAM.cliffTime);

function computeAccrualAt(nowSeconds: bigint, withdrawn = 0n) {
  const vested = vestedAmount(TOTAL, START, END, CLIFF, nowSeconds);
  return { vested, withdrawable: withdrawableAmount(vested, withdrawn) };
}

describe("useAccrual — vesting ceiling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("vested amount stops increasing once the stream is fully vested", () => {
    // One second before the end: not yet at ceiling.
    const beforeEnd = computeAccrualAt(END - 1n);
    expect(beforeEnd.vested).toBeLessThan(TOTAL);

    // At the end: exactly at the ceiling.
    const atEnd = computeAccrualAt(END);
    expect(atEnd.vested).toBe(TOTAL);

    // Well past the end: ceiling must not be exceeded.
    const pastEnd = computeAccrualAt(END + 1_000_000n);
    expect(pastEnd.vested).toBe(TOTAL);
  });

  it("the ceiling matches the stream's total amount", () => {
    const atCeiling = computeAccrualAt(END + 1n);
    expect(atCeiling.vested).toBe(TOTAL);
  });

  it("vested amount never exceeds total across the entire stream window", () => {
    for (let now = START; now <= END + 10n; now += 7n) {
      const { vested } = computeAccrualAt(now);
      expect(vested).toBeLessThanOrEqual(TOTAL);
    }
  });

  it("withdrawable is zero when all vested tokens have already been withdrawn", () => {
    // Simulate a stream that has fully vested and been fully withdrawn.
    const { withdrawable } = computeAccrualAt(END + 1n, TOTAL);
    expect(withdrawable).toBe(0n);
  });

  it("withdrawable never goes negative when withdrawn exceeds vested", () => {
    const { withdrawable } = computeAccrualAt(START + 1n, TOTAL);
    expect(withdrawable).toBeGreaterThanOrEqual(0n);
  });
});
