import { describe, expect, it } from "vitest";
import {
  TX_STAGES,
  TX_STAGE_LABELS,
  type TxStage,
} from "@/lib/contract";

describe("transaction progress stages", () => {
  it("defines the 4 canonical stages in order", () => {
    const expectedStages: TxStage[] = ["preparing", "signing", "submitting", "confirming"];
    expect(TX_STAGES.map((s) => s.id)).toEqual(expectedStages);
  });

  it("provides descriptive user-facing labels for all stages", () => {
    expect(TX_STAGE_LABELS.preparing).toBe("Preparing transaction...");
    expect(TX_STAGE_LABELS.signing).toBe("Awaiting wallet signature...");
    expect(TX_STAGE_LABELS.submitting).toBe("Submitting to network...");
    expect(TX_STAGE_LABELS.confirming).toBe("Confirming on network...");
  });

  it("includes label and detail metadata for every stage", () => {
    for (const stage of TX_STAGES) {
      expect(stage.label).toBeTruthy();
      expect(stage.detail).toBeTruthy();
      expect(TX_STAGE_LABELS[stage.id]).toBeTruthy();
    }
  });
});
