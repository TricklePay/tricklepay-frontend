import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks only createStream, keeping the real TransactionTimeoutError class so
// `instanceof` checks in submitCreateStream still work against it.
vi.mock("@/lib/contract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contract")>();
  return { ...actual, createStream: vi.fn() };
});

import { createStream, TransactionTimeoutError } from "@/lib/contract";
import type { CreateStreamParams } from "@/types/contract";

import { submitCreateStream } from "./create-stream-submission";

const mockedCreateStream = vi.mocked(createStream);

// Represents a stream a user filled the create form out for: a recipient, a
// token, an amount, and a time window — the "entered values" the acceptance
// criteria refers to.
const ENTERED_VALUES: CreateStreamParams = {
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  totalAmount: 1_000_000_000n, // 100 tokens at 7 decimals
  startTime: 1_700_000_000n,
  endTime: 1_700_003_600n,
  cliffTime: 1_700_000_000n,
};

describe("submitCreateStream", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes the create path with exactly the entered values on a valid submission", async () => {
    mockedCreateStream.mockResolvedValue("a1b2c3d4tx");
    const onStageChange = vi.fn();

    const result = await submitCreateStream(ENTERED_VALUES, onStageChange);

    expect(mockedCreateStream).toHaveBeenCalledTimes(1);
    expect(mockedCreateStream).toHaveBeenCalledWith(ENTERED_VALUES, onStageChange);
    expect(result).toEqual({ ok: true, hash: "a1b2c3d4tx" });
  });

  it("reports a submission failure with the underlying error message", async () => {
    mockedCreateStream.mockRejectedValue(new Error("The network rejected the transaction."));

    const result = await submitCreateStream(ENTERED_VALUES, vi.fn());

    expect(result).toEqual({ ok: false, message: "The network rejected the transaction." });
  });

  it("reports a timed-out confirmation as a failure carrying the tx hash for recovery", async () => {
    mockedCreateStream.mockRejectedValue(new TransactionTimeoutError("timeouthash456"));

    const result = await submitCreateStream(ENTERED_VALUES, vi.fn());

    expect(result).toEqual({
      ok: false,
      timeoutHash: "timeouthash456",
      message: "Confirmation timed out. The transaction was submitted to the network.",
    });
  });

  it("falls back to a generic message when the rejection isn't an Error", async () => {
    mockedCreateStream.mockRejectedValue("boom");

    const result = await submitCreateStream(ENTERED_VALUES, vi.fn());

    expect(result).toEqual({ ok: false, message: "Failed to create stream." });
  });
});
