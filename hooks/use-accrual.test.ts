import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StreamView } from "@/types/stream";

let state: { vested: bigint; withdrawable: bigint };
let effectFn: (() => void) | null;

vi.mock("react", () => ({
  useState: (init: () => { vested: bigint; withdrawable: bigint }) => {
    state = init();
    return [state, (v: { vested: bigint; withdrawable: bigint }) => { state = v; }];
  },
  useEffect: (fn: () => void) => {
    effectFn = fn;
  },
}));

vi.mock("@/lib/vesting", () => ({
  vestedAmount: vi.fn(),
  withdrawableAmount: vi.fn(),
}));

import { vestedAmount, withdrawableAmount } from "@/lib/vesting";
import { useAccrual } from "./use-accrual";

const mockVested = vi.mocked(vestedAmount);
const mockWithdrawable = vi.mocked(withdrawableAmount);

function makeStream(overrides: Partial<StreamView> = {}): StreamView {
  return {
    id: "1",
    sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    token: "USDC",
    totalAmount: "10000",
    withdrawn: "0",
    vested: "0",
    withdrawable: "0",
    locked: "10000",
    startTime: "1000",
    endTime: "2000",
    cliffTime: "0",
    cancelled: false,
    status: "streaming",
    progress: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  state = { vested: 0n, withdrawable: 0n };
  effectFn = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useAccrual", () => {
  it("returns an increasing value as time advances", () => {
    const stream = makeStream();

    vi.setSystemTime(new Date(1500 * 1000));
    mockVested.mockReturnValue(5000n);
    mockWithdrawable.mockReturnValue(5000n);
    useAccrual(stream);
    const first = state.vested;

    vi.setSystemTime(new Date(1600 * 1000));
    mockVested.mockReturnValue(6000n);
    mockWithdrawable.mockReturnValue(6000n);
    effectFn?.();
    const second = state.vested;

    expect(second).toBeGreaterThan(first);
  });

  it("controls the clock with fake timers", () => {
    const stream = makeStream();

    vi.setSystemTime(new Date(1200 * 1000));
    mockVested.mockReturnValue(2000n);
    mockWithdrawable.mockReturnValue(2000n);
    useAccrual(stream);

    vi.setSystemTime(new Date(1400 * 1000));
    mockVested.mockReturnValue(4000n);
    mockWithdrawable.mockReturnValue(4000n);
    effectFn?.();

    expect(state.vested).toBe(4000n);
  });
});
