import { Contract, Keypair, scValToNative, xdr } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invoke } from "@/lib/contract-invoke";
import { cancel, createStream, withdraw, withdrawAmount } from "@/lib/contract-operations";

vi.mock("@/lib/contract-invoke", () => ({ invoke: vi.fn() }));
vi.mock("@/lib/contract-network", () => ({ server: vi.fn(() => ({})) }));
vi.mock("@/lib/contract-transaction", () => ({ buildAndPrepareTransaction: vi.fn() }));

const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const SENDER = Keypair.random().publicKey();
const RECIPIENT = Keypair.random().publicKey();
const TOKEN = new Contract(CONTRACT_ID).address().toString();

// Runs the operation builder handed to invoke() against a real Contract and
// decodes the resulting invoke-host-function operation.
function decodeBuiltOperation() {
  const buildOp = vi.mocked(invoke).mock.calls[0][1];
  const operation = buildOp(new Contract(CONTRACT_ID));
  const invokeArgs = operation.body().invokeHostFunctionOp().hostFunction().invokeContract();
  return {
    method: invokeArgs.functionName().toString(),
    args: invokeArgs.args(),
  };
}

function scvTypes(args: xdr.ScVal[]): string[] {
  return args.map((arg) => arg.switch().name);
}

describe("contract operations", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset().mockResolvedValue("tx-hash");
  });

  it("builds create_stream with Address, i128 and u64 arguments", async () => {
    await createStream({
      sender: SENDER,
      recipient: RECIPIENT,
      token: TOKEN,
      totalAmount: 1_000_000_000n,
      startTime: 1_700_000_000n,
      endTime: 1_800_000_000n,
      cliffTime: 1_750_000_000n,
    });

    expect(vi.mocked(invoke).mock.calls[0][0]).toBe(SENDER);
    const { method, args } = decodeBuiltOperation();
    expect(method).toBe("create_stream");
    expect(scvTypes(args)).toEqual([
      "scvAddress",
      "scvAddress",
      "scvAddress",
      "scvI128",
      "scvU64",
      "scvU64",
      "scvU64",
    ]);
    expect(scValToNative(args[0])).toBe(SENDER);
    expect(scValToNative(args[1])).toBe(RECIPIENT);
    expect(scValToNative(args[3])).toBe(1_000_000_000n);
    expect(scValToNative(args[4])).toBe(1_700_000_000n);
    expect(scValToNative(args[5])).toBe(1_800_000_000n);
    expect(scValToNative(args[6])).toBe(1_750_000_000n);
  });

  it("builds withdraw with a u64 stream id", async () => {
    await withdraw(SENDER, 42n);

    const { method, args } = decodeBuiltOperation();
    expect(method).toBe("withdraw");
    expect(scvTypes(args)).toEqual(["scvU64"]);
    expect(scValToNative(args[0])).toBe(42n);
  });

  it("builds withdraw_amount with u64 and i128 arguments", async () => {
    await withdrawAmount(SENDER, 7n, 250_000n);

    const { method, args } = decodeBuiltOperation();
    expect(method).toBe("withdraw_amount");
    expect(scvTypes(args)).toEqual(["scvU64", "scvI128"]);
    expect(scValToNative(args[0])).toBe(7n);
    expect(scValToNative(args[1])).toBe(250_000n);
  });

  it("builds cancel with a u64 stream id", async () => {
    await cancel(SENDER, 9n);

    const { method, args } = decodeBuiltOperation();
    expect(method).toBe("cancel");
    expect(scvTypes(args)).toEqual(["scvU64"]);
    expect(scValToNative(args[0])).toBe(9n);
  });

  it("keeps amounts above 2^53 exact", async () => {
    const huge = 2n ** 53n + 1n;
    const hugest = 123_456_789_012_345_678_901_234_567n;

    await withdrawAmount(SENDER, 1n, huge);
    expect(scValToNative(decodeBuiltOperation().args[1])).toBe(huge);

    vi.mocked(invoke).mockClear();
    await createStream({
      sender: SENDER,
      recipient: RECIPIENT,
      token: TOKEN,
      totalAmount: hugest,
      startTime: 1n,
      endTime: 2n,
      cliffTime: 1n,
    });
    expect(scValToNative(decodeBuiltOperation().args[3])).toBe(hugest);
  });
});
