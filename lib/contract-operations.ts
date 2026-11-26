// Public write entry points for the stream contract (create, withdraw,
// withdraw_amount, cancel). Each funnels through invoke(); this module only
// maps application params to contract calls.

import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import type { Contract, xdr } from "@stellar/stellar-sdk";

import { invoke } from "@/lib/contract-invoke";
import { server } from "@/lib/contract-network";
import { buildAndPrepareTransaction } from "@/lib/contract-transaction";
import type { CreateStreamParams, TxStage } from "@/types/contract";

// Builds the create_stream contract call. Shared by the real invocation and
// the fee estimate so both simulate exactly the same operation.
function createStreamOperation(contract: Contract, params: CreateStreamParams): xdr.Operation {
  return contract.call(
    "create_stream",
    new Address(params.sender).toScVal(),
    new Address(params.recipient).toScVal(),
    new Address(params.token).toScVal(),
    nativeToScVal(params.totalAmount, { type: "i128" }),
    nativeToScVal(params.startTime, { type: "u64" }),
    nativeToScVal(params.endTime, { type: "u64" }),
    nativeToScVal(params.cliffTime, { type: "u64" }),
  );
}

export async function createStream(
  params: CreateStreamParams,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  return invoke(params.sender, (contract) => createStreamOperation(contract, params), onStageChange);
}

/**
 * Best-effort estimate of the network fee for a create-stream transaction, in
 * stroops. Runs the same simulation prepareTransaction runs before signing —
 * which surfaces the Soroban resource footprint — so the cost can be shown on
 * the review step, before any wallet prompt appears. Nothing is signed or
 * submitted. Throws when the estimate cannot be produced (e.g. an unfunded
 * account or an unreachable RPC), so callers must treat it as optional.
 */
export async function estimateCreateStreamFee(params: CreateStreamParams): Promise<bigint> {
  const prepared = await buildAndPrepareTransaction(server(), params.sender, (contract) =>
    createStreamOperation(contract, params),
  );
  return BigInt(prepared.fee);
}

export async function withdraw(
  caller: string,
  streamId: bigint,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  return invoke(
    caller,
    (contract) => contract.call("withdraw", nativeToScVal(streamId, { type: "u64" })),
    onStageChange,
  );
}

/**
 * Withdraws a specific amount from a stream instead of the full vested balance.
 * Maps to the contract's `withdraw_amount(id, amount)` entry point.
 * `amount` is in base units of the stream's token.
 */
export async function withdrawAmount(
  caller: string,
  streamId: bigint,
  amount: bigint,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  return invoke(
    caller,
    (contract) =>
      contract.call(
        "withdraw_amount",
        nativeToScVal(streamId, { type: "u64" }),
        nativeToScVal(amount, { type: "i128" }),
      ),
    onStageChange,
  );
}

export async function cancel(
  caller: string,
  streamId: bigint,
  onStageChange?: (stage: TxStage) => void,
): Promise<string> {
  return invoke(
    caller,
    (contract) => contract.call("cancel", nativeToScVal(streamId, { type: "u64" })),
    onStageChange,
  );
}
