// Shapes for the on-chain write path (lib/contract.ts) and everything that
// surfaces its progress (components/transaction-progress.tsx and the
// use-create-stream-form / use-stream-actions hooks).

/** Parameters for creating a new stream, matching the contract's create_stream entry point. */
export interface CreateStreamParams {
  sender: string;
  recipient: string;
  token: string;
  totalAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  cliffTime: bigint;
}

/** A stage in the build -> sign -> submit -> confirm lifecycle of a contract invocation. */
export type TxStage = "preparing" | "signing" | "submitting" | "confirming";

/** Display metadata for one entry in the transaction progress indicator. */
export interface TxStageInfo {
  id: TxStage;
  label: string;
  detail: string;
}
