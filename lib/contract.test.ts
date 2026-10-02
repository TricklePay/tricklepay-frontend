import { getNetwork } from "@stellar/freighter-api";
import { rpc } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionTimeoutError, confirmTransaction, createStream, isTransactionPending } from "@/lib/contract";
import { CONTRACT_ERROR_MESSAGES, GENERIC_FAILURE, parseContractError } from "@/lib/contract-errors";
import { TX_STAGES, TX_STAGE_LABELS } from "@/lib/contract-messages";
import type { CreateStreamParams, TxStage } from "@/types/contract";

vi.mock("@stellar/freighter-api", () => ({
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn(),
    },
  };
});

const PARAMS: CreateStreamParams = {
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  token: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  totalAmount: 1_000_000_000n,
  startTime: 1_700_000_000n,
  endTime: 1_700_003_600n,
  cliffTime: 1_700_000_000n,
};

describe("contract configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails clearly when NEXT_PUBLIC_CONTRACT_ID is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ID", "");
    await expect(import("./config")).rejects.toThrow(/NEXT_PUBLIC_CONTRACT_ID is not set/);
  });
});

describe("contract error mapping", () => {
  it("returns the mapped message for every known error code", () => {
    const knownCodes = Object.keys(CONTRACT_ERROR_MESSAGES).map(Number);
    expect(knownCodes.length).toBeGreaterThan(0);

    for (const code of knownCodes) {
      const result = parseContractError(`Error(Contract, #${code})`);
      expect(result).toBe(CONTRACT_ERROR_MESSAGES[code]);
    }
  });

  it("covers exactly the contract's error discriminants", () => {
    // Mirrors StreamError in the contract's error.rs. 2 is the retired
    // Unauthorized variant, kept for contracts deployed before its removal.
    // If the contract gains or drops a variant, this fails until the table
    // is updated — the mapping drifted out of sync once already.
    expect(Object.keys(CONTRACT_ERROR_MESSAGES).map(Number).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("maps NothingToWithdraw (7) to an actionable message", () => {
    expect(parseContractError("Error(Contract, #7)")).toBe(
      "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
    );
  });

  it("maps InsufficientBalance (8) to an actionable message", () => {
    expect(parseContractError("Error(Contract, #8)")).toBe(
      "That is more than you can withdraw right now.",
    );
  });

  it("maps StreamNotFound (1) correctly", () => {
    expect(parseContractError("Error(Contract, #1)")).toBe("Stream not found.");
  });

  it("maps InvalidTimeRange (3) correctly", () => {
    expect(parseContractError("Error(Contract, #3)")).toBe(
      "Invalid time range — the stream must start before it ends.",
    );
  });

  it("maps AlreadyCancelled (6) correctly", () => {
    expect(parseContractError("Error(Contract, #6)")).toBe(
      "This stream has already been cancelled.",
    );
  });

  it("maps the codes added after the first deployment", () => {
    expect(parseContractError("Error(Contract, #9)")).toBe(
      "This stream has already completed and can no longer be cancelled.",
    );
    expect(parseContractError("Error(Contract, #10)")).toBe(
      "That amount is too large. The total must not exceed 9223372036854775807.",
    );
  });

  it("still maps Unauthorized (2), which older deployed contracts emit", () => {
    expect(parseContractError("Error(Contract, #2)")).toBe(
      "You are not authorized to perform this action.",
    );
  });

  it("returns a fallback with the raw code for unmapped codes while mapped codes are unaffected", () => {
    expect(parseContractError("Error(Contract, #99)")).toBe(
      `${GENERIC_FAILURE} (error code 99)`,
    );
    expect(parseContractError("Error(Contract, #0)")).toBe(
      `${GENERIC_FAILURE} (error code 0)`,
    );
    // Ensure a mapped code is unaffected
    expect(parseContractError("Error(Contract, #1)")).toBe("Stream not found.");
  });

  it("returns the generic failure message when no error token is present", () => {
    expect(parseContractError("something went wrong")).toBe(GENERIC_FAILURE);
    expect(parseContractError("")).toBe(GENERIC_FAILURE);
    expect(parseContractError("InvokeHostFunctionTrapped")).toBe(GENERIC_FAILURE);
  });

  it("handles whitespace variations inside the error token", () => {
    // The regex allows optional whitespace between the comma and hash
    expect(parseContractError("Error(Contract,#7)")).toBe(
      "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
    );
    expect(parseContractError("Error(Contract,  #7)")).toBe(
      "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
    );
  });

  it("extracts the code when the token is embedded inside a longer message", () => {
    const embeddedMsg =
      "HostError: invocation trapped — Error(Contract, #7) at function withdraw";
    expect(parseContractError(embeddedMsg)).toBe(
      "Nothing to withdraw yet — no tokens have vested since your last withdrawal.",
    );
  });

  it("uses the first matching code when multiple tokens appear", () => {
    // Unlikely in practice, but regex returns the first match
    const multiMsg = "Error(Contract, #3) then Error(Contract, #4)";
    expect(parseContractError(multiMsg)).toBe(
      "Invalid time range — the stream must start before it ends.",
    );
  });
});

describe("contract submission guard", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("reports no transaction pending initially", () => {
    expect(isTransactionPending()).toBe(false);
  });

  it("releases the guard after a failed submission", async () => {
    vi.mocked(getNetwork).mockRejectedValueOnce(new Error("wallet unreachable"));

    await expect(createStream(PARAMS)).rejects.toThrow("wallet unreachable");
    expect(isTransactionPending()).toBe(false);
  });

  it("accepts a further submission after a failure", async () => {
    vi.mocked(getNetwork).mockRejectedValue(new Error("wallet unreachable"));

    await expect(createStream(PARAMS)).rejects.toThrow("wallet unreachable");
    expect(isTransactionPending()).toBe(false);

    await expect(createStream(PARAMS)).rejects.toThrow("wallet unreachable");
    expect(vi.mocked(getNetwork)).toHaveBeenCalledTimes(2);
    expect(isTransactionPending()).toBe(false);
  });
});

describe("contract confirmation timeout", () => {
  describe("TransactionTimeoutError", () => {
    it("stores transaction hash and descriptive timeout message", () => {
      const dummyHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const err = new TransactionTimeoutError(dummyHash);

      expect(err.name).toBe("TransactionTimeoutError");
      expect(err.txHash).toBe(dummyHash);
      expect(err.message).toBe("Timed out waiting for confirmation.");
    });

    it("allows custom message overrides", () => {
      const dummyHash = "0xabc123";
      const customMsg = "Custom timeout message";
      const err = new TransactionTimeoutError(dummyHash, customMsg);

      expect(err.txHash).toBe(dummyHash);
      expect(err.message).toBe(customMsg);
    });
  });

  describe("confirmation poll bounds", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.resetAllMocks();
    });

    it("stops polling at the timeout and throws a TransactionTimeoutError carrying the hash", async () => {
      const mockGetTransaction = vi.fn().mockResolvedValue({
        status: "PENDING",
      });
      vi.mocked(rpc.Server).mockImplementation(
        class {
          getTransaction = mockGetTransaction;
        } as unknown as typeof rpc.Server,
      );

      const hash = "0xtimedout";
      const promise = confirmTransaction(hash);
      const assertion = expect(promise).rejects.toThrowError(TransactionTimeoutError);

      // Fast-forward 30 seconds (30 attempts * 1_000ms)
      // We await advanceTimersByTimeAsync to yield the event loop so the sleep resolves.
      for (let i = 0; i < 30; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      await assertion;
      await expect(promise).rejects.toMatchObject({ txHash: hash });
      expect(mockGetTransaction).toHaveBeenCalledTimes(30);
    });
  });
});

describe("contract progress copy", () => {
  it("defines the 4 canonical stages in order", () => {
    const expectedStages: TxStage[] = ["preparing", "signing", "submitting", "confirming"];
    expect(TX_STAGES.map((s) => s.id)).toEqual(expectedStages);
  });

  it("provides descriptive user-facing labels for all stages", () => {
    expect(TX_STAGE_LABELS.preparing).toBe("Preparing transaction...");
    expect(TX_STAGE_LABELS.signing).toBe("Awaiting wallet signature...");
    expect(TX_STAGE_LABELS.submitting).toBe("Submitting to network...");
    expect(TX_STAGE_LABELS.confirming).toBe("Confirming on network...");
  });

  it("includes label and detail metadata for every stage", () => {
    for (const stage of TX_STAGES) {
      expect(stage.label).toBeTruthy();
      expect(stage.detail).toBeTruthy();
      expect(TX_STAGE_LABELS[stage.id]).toBeTruthy();
    }
  });
});
