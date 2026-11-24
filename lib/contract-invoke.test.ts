import type { xdr } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirm } from "@/lib/contract-confirm";
import { acquireInvocation, releaseInvocation } from "@/lib/contract-guard";
import { invoke } from "@/lib/contract-invoke";
import { TX_ALREADY_IN_PROGRESS_MESSAGE } from "@/lib/contract-messages";
import { ensureWalletNetwork, server } from "@/lib/contract-network";
import {
  buildAndPrepareTransaction,
  signPreparedTransaction,
  submitSignedTransaction,
} from "@/lib/contract-transaction";
import type { TxStage } from "@/types/contract";

vi.mock("@/lib/contract-confirm", () => ({ confirm: vi.fn() }));
vi.mock("@/lib/contract-guard", () => ({
  acquireInvocation: vi.fn(),
  releaseInvocation: vi.fn(),
}));
vi.mock("@/lib/contract-network", () => ({
  ensureWalletNetwork: vi.fn(),
  server: vi.fn(),
}));
vi.mock("@/lib/contract-transaction", () => ({
  buildAndPrepareTransaction: vi.fn(),
  signPreparedTransaction: vi.fn(),
  submitSignedTransaction: vi.fn(),
}));

const buildOp = () => ({}) as xdr.Operation;

describe("invoke", () => {
  let calls: string[];
  let stages: TxStage[];

  beforeEach(() => {
    vi.resetAllMocks();
    calls = [];
    stages = [];

    vi.mocked(acquireInvocation).mockImplementation(() => {
      calls.push("acquire");
      return true;
    });
    vi.mocked(releaseInvocation).mockImplementation(() => {
      calls.push("release");
    });
    vi.mocked(ensureWalletNetwork).mockImplementation(async () => {
      calls.push("network");
    });
    vi.mocked(server).mockReturnValue({} as ReturnType<typeof server>);
    vi.mocked(buildAndPrepareTransaction).mockImplementation(async () => {
      calls.push("build");
      return { toXDR: () => "PREPARED_XDR" } as never;
    });
    vi.mocked(signPreparedTransaction).mockImplementation(async () => {
      calls.push("sign");
      return "SIGNED_XDR";
    });
    vi.mocked(submitSignedTransaction).mockImplementation(async () => {
      calls.push("submit");
      return "HASH";
    });
    vi.mocked(confirm).mockImplementation(async () => {
      calls.push("confirm");
      return "HASH";
    });
  });

  it("runs guard, network check and the four stages in order, then releases the lock", async () => {
    await expect(invoke("GCALLER", buildOp)).resolves.toBe("HASH");

    expect(calls).toEqual(["acquire", "network", "build", "sign", "submit", "confirm", "release"]);
  });

  it("reports each stage to onStageChange exactly once, in order", async () => {
    await invoke("GCALLER", buildOp, (stage) => stages.push(stage));

    expect(stages).toEqual(["preparing", "signing", "submitting", "confirming"]);
  });

  it("skips the following stages and releases the lock when a stage fails", async () => {
    vi.mocked(signPreparedTransaction).mockImplementation(async () => {
      calls.push("sign");
      throw new Error("signing failed");
    });

    await expect(invoke("GCALLER", buildOp, (stage) => stages.push(stage))).rejects.toThrow(
      "signing failed",
    );

    expect(calls).toEqual(["acquire", "network", "build", "sign", "release"]);
    expect(submitSignedTransaction).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(stages).toEqual(["preparing", "signing"]);
    expect(releaseInvocation).toHaveBeenCalledTimes(1);
  });

  it("releases the lock without reporting a stage when the network check fails", async () => {
    vi.mocked(ensureWalletNetwork).mockRejectedValue(new Error("wrong network"));

    await expect(invoke("GCALLER", buildOp, (stage) => stages.push(stage))).rejects.toThrow(
      "wrong network",
    );

    expect(stages).toEqual([]);
    expect(buildAndPrepareTransaction).not.toHaveBeenCalled();
    expect(releaseInvocation).toHaveBeenCalledTimes(1);
  });

  it("rejects without running any step when another invocation holds the lock", async () => {
    vi.mocked(acquireInvocation).mockReturnValue(false);

    await expect(invoke("GCALLER", buildOp)).rejects.toThrow(TX_ALREADY_IN_PROGRESS_MESSAGE);

    expect(ensureWalletNetwork).not.toHaveBeenCalled();
    expect(releaseInvocation).not.toHaveBeenCalled();
  });
});
