import { nativeToScVal } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

const { simulateTransaction } = vi.hoisted(() => ({ simulateTransaction: vi.fn() }));

vi.mock("@/lib/contract-network", () => ({
  server: () => ({ simulateTransaction }),
}));

import { simulateRead } from "@/lib/contract-read";

const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

describe("simulateRead", () => {
  it("returns the native value from a successful simulation", async () => {
    simulateTransaction.mockResolvedValue({
      transactionData: {},
      result: { retval: nativeToScVal("EURC", { type: "string" }) },
    });

    await expect(simulateRead<string>(TOKEN, "symbol")).resolves.toBe("EURC");
  });

  it("throws the RPC simulation error message", async () => {
    simulateTransaction.mockResolvedValue({
      error: "HostError: contract not found",
    });

    await expect(simulateRead(TOKEN, "symbol")).rejects.toThrow(
      "HostError: contract not found",
    );
  });

  it("throws a clear message when a successful simulation has no result", async () => {
    simulateTransaction.mockResolvedValue({ transactionData: {} });

    await expect(simulateRead(TOKEN, "balance")).rejects.toThrow(
      "Balance read did not return a value.",
    );
  });
});
