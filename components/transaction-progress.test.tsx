import { describe, expect, it } from "vitest";

import { TX_STAGES, TX_STAGE_LABELS } from "@/lib/contract-messages";
import type { TxStage } from "@/types/contract";

import { TransactionProgress } from "./transaction-progress";

// Grid step layout: `<div className="grid ...">{TX_STAGES.map(...)}</div>` is
// the progress element's second top-level child; each mapped step is
// `<div>{barDiv}{textDiv}</div>`, and textDiv is `<div>{labelSpan}{detailSpan}</div>`.
function steps(el: NonNullable<ReturnType<typeof TransactionProgress>>) {
  const [, grid] = el.props.children;
  return grid.props.children;
}

describe("TransactionProgress", () => {
  it("renders nothing when there is no active transaction", () => {
    expect(TransactionProgress({ stage: null })).toBeNull();
  });

  it("announces itself as a polite, labeled status region", () => {
    const el = TransactionProgress({ stage: "preparing" })!;

    expect(el.props.role).toBe("status");
    expect(el.props["aria-live"]).toBe("polite");
    expect(el.props["aria-label"]).toBe("Transaction progress");
  });

  it("renders one column per transaction stage", () => {
    const el = TransactionProgress({ stage: "preparing" })!;

    expect(steps(el)).toHaveLength(TX_STAGES.length);
  });

  it.each(TX_STAGES.map((s, idx) => [s.id, idx] as const))(
    "reports stage %s as position %i of the total",
    (stage, idx) => {
      const el = TransactionProgress({ stage })!;
      const [headerRow] = el.props.children;
      const [headerSpan] = headerRow.props.children;
      // The span's children are the text/number fragments "Stage ", n, " of ",
      // total, ": ", label — join them back into the sentence they render as.
      const text = (headerSpan.props.children as unknown[]).map(String).join("");

      expect(text).toBe(
        `Stage ${idx + 1} of ${TX_STAGES.length}: ${TX_STAGE_LABELS[stage]}`,
      );
    },
  );

  it("marks earlier stages as done and the active stage as current", () => {
    const stage: TxStage = "submitting";
    const el = TransactionProgress({ stage })!;
    const currentIdx = TX_STAGES.findIndex((s) => s.id === stage);
    const [preparingStep, signingStep, submittingStep, confirmingStep] = steps(el);

    // Done: earlier stages get the emerald "done" treatment.
    for (const step of [preparingStep, signingStep]) {
      const [bar, textWrap] = step.props.children;
      const [label] = textWrap.props.children;
      expect(bar.props.className).toContain("bg-emerald-500");
      expect(label.props.className).toContain("text-emerald-400");
    }

    // Current: the active stage is visually distinct and still pulsing.
    const [currentBar, currentTextWrap] = submittingStep.props.children;
    const [currentLabel] = currentTextWrap.props.children;
    expect(currentBar.props.className).toContain("animate-pulse");
    expect(currentLabel.props.className).toContain("font-semibold");
    expect(currentIdx).toBe(2);

    // Pending: the stage that hasn't started yet stays neutral.
    const [pendingBar, pendingTextWrap] = confirmingStep.props.children;
    const [pendingLabel] = pendingTextWrap.props.children;
    expect(pendingBar.props.className).toContain("bg-neutral-800");
    expect(pendingBar.props.className).not.toContain("bg-emerald-500");
    expect(pendingLabel.props.className).toContain("text-neutral-500");
  });

  it("marks no stage as done when the first stage is active", () => {
    const el = TransactionProgress({ stage: "preparing" })!;
    const allSteps = steps(el);

    for (const step of allSteps) {
      const [bar] = step.props.children;
      expect(bar.props.className).not.toContain("bg-emerald-500");
    }
  });

  it("marks every prior stage as done when the final stage is active", () => {
    const el = TransactionProgress({ stage: "confirming" })!;
    const allSteps = steps(el);

    for (const step of allSteps.slice(0, -1)) {
      const [bar] = step.props.children;
      expect(bar.props.className).toContain("bg-emerald-500");
    }
  });

  it("labels each column with its stage name and detail", () => {
    const el = TransactionProgress({ stage: "preparing" })!;
    const output = JSON.stringify(el);

    for (const step of TX_STAGES) {
      expect(output).toContain(step.label);
      expect(output).toContain(step.detail);
    }
  });
});
