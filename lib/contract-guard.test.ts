import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirm } from "@/lib/contract-confirm";
import {
  acquireInvocation,
  isTransactionPending,
  releaseInvocation,
} from "@/lib/contract-guard";
import { invoke } from "@/lib/contract-invoke";
import { TX_ALREADY_IN_PROGRESS_MESSAGE } from "@/lib/contract-messages";
import { ensureWalletNetwork } from "@/lib/contract-network";
import {
  buildAndPrepareTransaction,
  signPreparedTransaction,
  submitSignedTransaction,
} from "@/lib/contract-transaction";

vi.mock("@/lib/contract-confirm", () => ({ confirm: vi.fn() }));
vi.mock("@/lib/contract-network", () => ({
  ensureWalletNetwork: vi.fn(),
  server: vi.fn(() => ({})),
}));
vi.mock("@/lib/contract-transaction", () => ({
  buildAndPrepareTransaction: vi.fn(),
  signPreparedTransaction: vi.fn(),
  submitSignedTransaction: vi.fn(),
}));

const buildOp = vi.fn();

describe("invocation lock", () => {
  beforeEach(() => {
    releaseInvocation();
  });

  it("acquires and releases", () => {
    expect(isTransactionPending()).toBe(false);
    expect(acquireInvocation()).toBe(true);
    expect(isTransactionPending()).toBe(true);
    releaseInvocation();
    expect(isTransactionPending()).toBe(false);
  });

  it("refuses a second acquire until released", () => {
    expect(acquireInvocation()).toBe(true);
    expect(acquireInvocation()).toBe(false);
    releaseInvocation();
    expect(acquireInvocation()).toBe(true);
  });
});

describe("invoke and the lock", () => {
  beforeEach(() => {
    releaseInvocation();
    vi.mocked(ensureWalletNetwork).mockReset().mockResolvedValue(undefined);
    vi.mocked(buildAndPrepareTransaction)
      .mockReset()
      .mockResolvedValue({ toXDR: () => "prepared-xdr" } as never);
    vi.mocked(signPreparedTransaction).mockReset().mockResolvedValue("signed-xdr");
    vi.mocked(submitSignedTransaction).mockReset().mockResolvedValue("tx-hash");
    vi.mocked(confirm).mockReset().mockResolvedValue("tx-hash");
  });

  it("rejects a second concurrent call with the in-progress message", async () => {
    let openGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    vi.mocked(ensureWalletNetwork).mockReturnValueOnce(gate);

    const first = invoke("GCALLER", buildOp);
    await expect(invoke("GCALLER", buildOp)).rejects.toThrow(TX_ALREADY_IN_PROGRESS_MESSAGE);
    expect(isTransactionPending()).toBe(true);

    openGate();
    await expect(first).resolves.toBe("tx-hash");
    expect(isTransactionPending()).toBe(false);
  });

  it("releases the lock after a successful call", async () => {
    await invoke("GCALLER", buildOp);
    expect(isTransactionPending()).toBe(false);
  });

  it.each([
    ["network check", () => vi.mocked(ensureWalletNetwork)],
    ["preparing", () => vi.mocked(buildAndPrepareTransaction)],
    ["signing", () => vi.mocked(signPreparedTransaction)],
    ["submitting", () => vi.mocked(submitSignedTransaction)],
    ["confirming", () => vi.mocked(confirm)],
  ])("releases the lock after a failure at the %s stage", async (_stage, getMock) => {
    getMock().mockRejectedValueOnce(new Error("stage failed"));

    await expect(invoke("GCALLER", buildOp)).rejects.toThrow("stage failed");
    expect(isTransactionPending()).toBe(false);

    // A new invocation can start again.
    await expect(invoke("GCALLER", buildOp)).resolves.toBe("tx-hash");
  });
});
