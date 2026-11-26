import type { xdr } from "@stellar/stellar-sdk";

import { config } from "@/lib/config";
import { TRANSACTION_BASE_FEE, TX_TIMEOUT_SECONDS } from "@/lib/contract-config";

const READ_ONLY_SEQUENCE = "0";
const READ_ONLY_SOURCE_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

/**
 * Simulates a read-only Soroban contract call and returns its native value.
 */
export async function simulateRead<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const [{ Account, Contract, rpc, scValToNative, TransactionBuilder }, { server }] =
    await Promise.all([import("@stellar/stellar-sdk"), import("@/lib/contract-network")]);

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(
    new Account(READ_ONLY_SOURCE_ACCOUNT, READ_ONLY_SEQUENCE),
    {
      fee: TRANSACTION_BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    },
  )
    .addOperation(contract.call(method, ...args))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  const simulation = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }
  if (!rpc.Api.isSimulationSuccess(simulation)) {
    if (method === "balance") {
      throw new Error("Balance read did not complete.");
    }
    if (method === "decimals") {
      throw new Error("Token decimals read did not complete.");
    }
    throw new Error(`Token ${method} read did not complete.`);
  }
  if (!simulation.result) {
    if (method === "balance") {
      throw new Error("Balance read did not return a value.");
    }
    if (method === "decimals") {
      throw new Error("Token decimals read did not return a value.");
    }
    throw new Error(`Token ${method} read did not return a value.`);
  }

  return scValToNative(simulation.result.retval) as T;
}
