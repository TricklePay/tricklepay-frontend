"use client";

import { TX_STAGES, TX_STAGE_LABELS, type TxStage } from "@/lib/contract";


interface Props {
  /** Current transaction stage, or null when no transaction is in progress. */
  stage: TxStage | null;
}

/**
 * Accessible, responsive progress stage component for transaction lifecycles
 * (Preparing -> Signing -> Submitting -> Confirming). Shows the current stage
 * with visual progress indicators. When stage is null, renders nothing.
 */
export function TransactionProgress({ stage }: Props) {
  if (!stage) return null;

  const currentIdx = TX_STAGES.findIndex((s) => s.id === stage);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Transaction progress"
      className="my-3 rounded-lg border border-neutral-800 bg-neutral-900/80 p-4 text-xs"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-semibold text-neutral-200">
          Stage {currentIdx >= 0 ? currentIdx + 1 : 1} of {TX_STAGES.length}: {TX_STAGE_LABELS[stage]}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
          Processing
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {TX_STAGES.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div key={step.id} className="flex flex-col gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                  isDone
                    ? "bg-emerald-500"
                    : isCurrent
                      ? "bg-neutral-100 animate-pulse"
                      : "bg-neutral-800"
                }`}
              />
              <div className="flex flex-col">
                <span
                  className={`font-medium ${
                    isDone
                      ? "text-emerald-400"
                      : isCurrent
                        ? "text-neutral-100 font-semibold"
                        : "text-neutral-500"
                  }`}
                >
                  {step.label}
                </span>
                <span className="hidden sm:inline text-[10px] text-neutral-500 truncate">
                  {step.detail}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
