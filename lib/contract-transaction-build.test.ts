import { Account, Keypair } from "@stellar/stellar-sdk";
import type { Contract, rpc, xdr } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTRACT_ERROR_MESSAGES } from "@/lib/contract-errors";
import { ACCOUNT_NOT_FOUND_MESSAGE } from "@/lib/contract-messages";
import { buildAndPrepareTransaction } from "@/lib/contract-transaction";

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: vi.fn(),
}));

const caller = Keypair.random().publicKey();
const buildOp = (contract: Contract): xdr.Operation => contract.call("noop");

function mockServer(
  getAccount: ReturnType<typeof vi.fn>,
  prepareTransaction: ReturnType<typeof vi.fn>,
): rpc.Server {
  return { getAccount, prepareTransaction } as unknown as rpc.Server;
}

describe("buildAndPrepareTransaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the prepared transaction from the RPC simulation", async () => {
    const prepared = { toXDR: () => "PREPARED_XDR" };
    const getAccount = vi.fn().mockResolvedValue(new Account(caller, "1"));
    const prepareTransaction = vi.fn().mockResolvedValue(prepared);

    const result = await buildAndPrepareTransaction(
      mockServer(getAccount, prepareTransaction),
      caller,
      buildOp,
    );

    expect(result).toBe(prepared);
    expect(getAccount).toHaveBeenCalledWith(caller);
    expect(prepareTransaction).toHaveBeenCalledTimes(1);
  });

  it("maps a missing account to ACCOUNT_NOT_FOUND_MESSAGE before simulating", async () => {
    const getAccount = vi.fn().mockRejectedValue(new Error("Account not found: " + caller));
    const prepareTransaction = vi.fn();

    await expect(
      buildAndPrepareTransaction(mockServer(getAccount, prepareTransaction), caller, buildOp),
    ).rejects.toThrow(ACCOUNT_NOT_FOUND_MESSAGE);
    expect(prepareTransaction).not.toHaveBeenCalled();
  });

  it("rethrows other account lookup errors unchanged", async () => {
    const getAccount = vi.fn().mockRejectedValue(new Error("network down"));
    const prepareTransaction = vi.fn();

    await expect(
      buildAndPrepareTransaction(mockServer(getAccount, prepareTransaction), caller, buildOp),
    ).rejects.toThrow("network down");
    expect(prepareTransaction).not.toHaveBeenCalled();
  });

  it("translates a contract error from the simulation", async () => {
    const getAccount = vi.fn().mockResolvedValue(new Account(caller, "1"));
    const prepareTransaction = vi
      .fn()
      .mockRejectedValue(new Error("HostError: Error(Contract, #7)"));

    await expect(
      buildAndPrepareTransaction(mockServer(getAccount, prepareTransaction), caller, buildOp),
    ).rejects.toThrow(CONTRACT_ERROR_MESSAGES[7]);
  });
});
