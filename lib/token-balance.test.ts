import { nativeToScVal } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

const { simulateTransaction } = vi.hoisted(() => ({ simulateTransaction: vi.fn() }));

vi.mock("@/lib/contract-network", () => ({
  server: () => ({ simulateTransaction }),
}));

import { readTokenBalance } from "@/lib/token-balance";

const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const HOLDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("readTokenBalance", () => {
  it("returns the token balance in base units", async () => {
    simulateTransaction.mockResolvedValue({
      transactionData: {},
      result: { retval: nativeToScVal(5_000_000n, { type: "i128" }) },
    });

    await expect(readTokenBalance(TOKEN, HOLDER)).resolves.toBe(5_000_000n);
  });

  it("throws when the read fails, so callers treat it as best-effort", async () => {
    simulateTransaction.mockResolvedValue({ error: "HostError: contract not found" });

    await expect(readTokenBalance(TOKEN, HOLDER)).rejects.toThrow();
  });

  it("throws when the simulation succeeds but has no result", async () => {
    simulateTransaction.mockResolvedValue({
      transactionData: {},
    });

    await expect(readTokenBalance(TOKEN, HOLDER)).rejects.toThrow("Balance read did not return a value.");
  });
});
