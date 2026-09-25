import { createStream, TransactionTimeoutError, type CreateStreamParams, type TxStage } from "@/lib/contract";

/**
 * Result of submitting a create-stream transaction. A timed-out confirmation
 * is reported as a failure carrying `timeoutHash`, so the caller can offer to
 * re-check status instead of re-submitting.
 */
export type CreateStreamSubmission =
  | { ok: true; hash: string }
  | { ok: false; message: string; timeoutHash?: string };

/**
 * Invokes the create-stream transaction (build, sign, submit, confirm — see
 * lib/contract.ts) and translates the outcome into a plain result instead of
 * throwing, so the caller can branch on it directly.
 *
 * Kept free of React so it can be exercised in a test by mocking
 * lib/contract's createStream, independent of useCreateStreamForm's state
 * wiring (which needs a live wallet/router/network-guard context to render).
 */
export async function submitCreateStream(
  params: CreateStreamParams,
  onStageChange: (stage: TxStage) => void,
): Promise<CreateStreamSubmission> {
  try {
    const hash = await createStream(params, onStageChange);
    return { ok: true, hash };
  } catch (err) {
    if (err instanceof TransactionTimeoutError) {
      return {
        ok: false,
        timeoutHash: err.txHash,
        message: "Confirmation timed out. The transaction was submitted to the network.",
      };
    }
    return { ok: false, message: err instanceof Error ? err.message : "Failed to create stream." };
  }
}
