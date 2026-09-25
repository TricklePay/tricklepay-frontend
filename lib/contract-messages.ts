// User-facing copy for the transaction stage indicator (see
// components/transaction-progress.tsx). Kept apart from lib/contract.ts so
// the submission flow's logic and its presentation strings can be reviewed
// independently — lib/contract.ts only ever reports a stage id
// ("preparing" | "signing" | "submitting" | "confirming"), never these
// labels, so it has no need to import this module.

import type { TxStage, TxStageInfo } from "@/types/contract";

export const TX_STAGES: TxStageInfo[] = [
  { id: "preparing", label: "Prepare", detail: "Simulate transaction" },
  { id: "signing", label: "Sign", detail: "Wallet signature" },
  { id: "submitting", label: "Submit", detail: "Broadcast to network" },
  { id: "confirming", label: "Confirm", detail: "On-chain confirmation" },
];

export const TX_STAGE_LABELS: Record<TxStage, string> = {
  preparing: "Preparing transaction...",
  signing: "Awaiting wallet signature...",
  submitting: "Submitting to network...",
  confirming: "Confirming on network...",
};
