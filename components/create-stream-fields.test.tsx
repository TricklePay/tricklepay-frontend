import { describe, expect, it, vi } from "vitest";

import type { CreateFormRefs } from "@/hooks/use-create-stream-form";

import { CreateStreamFields } from "./create-stream-fields";

describe("CreateStreamFields", () => {
  const defaultProps = {
    values: {
      recipient: "",
      token: "",
      amount: "",
      start: "",
      end: "",
      cliff: "",
    },
    errors: {},
    refs: {
      recipient: { current: null },
      token: { current: null },
      amount: { current: null },
      start: { current: null },
      end: { current: null },
      cliff: { current: null },
    } as CreateFormRefs,
    onFieldChange: vi.fn(),
    previewRate: null,
    previewDuration: null,
    feedback: null,
    submitting: false,
    submitDisabled: false,
    onSubmit: vi.fn(),
  };

  it("renders every expected field", () => {
    const element = CreateStreamFields(defaultProps);
    const renderedOutput = JSON.stringify(element);

    expect(renderedOutput).toContain("Recipient address");
    expect(renderedOutput).toContain("Token contract id");
    expect(renderedOutput).toContain("Amount");
    expect(renderedOutput).toContain("Start");
    expect(renderedOutput).toContain("End");
    // We expect the cliff field to be present
    expect(renderedOutput).toContain("Cliff");
  });

  it("marks the cliff field specifically as optional", () => {
    const element = CreateStreamFields(defaultProps);
    const renderedOutput = JSON.stringify(element);

    // Assert the optional indicator is present on the cliff field
    expect(renderedOutput).toContain("Cliff (optional)");
    
    // Assert required fields do NOT have the optional indicator
    expect(renderedOutput).not.toContain("Recipient address (optional)");
    expect(renderedOutput).not.toContain("Token contract id (optional)");
    expect(renderedOutput).not.toContain("Amount (optional)");
    expect(renderedOutput).not.toContain("Start (optional)");
    expect(renderedOutput).not.toContain("End (optional)");
  });
});
