import { describe, it, expect, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    // Suppress the console.error side-effect; the behaviour under test is the
    // rendered output, not the logging.
    useEffect: vi.fn(),
  };
});

import ErrorBoundary from "@/app/error";

describe("ErrorBoundary (app/error.tsx)", () => {
  const reset = vi.fn();

  it("renders an error message when a child throws", () => {
    const error = Object.assign(new Error("Stream failed to load"), { digest: undefined });
    const output = JSON.stringify(ErrorBoundary({ error, reset }));

    expect(output).toContain("Something went wrong");
    expect(output).toContain("Stream failed to load");
  });

  it("falls back to a generic message when the error has no message", () => {
    const error = Object.assign(new Error(""), { digest: undefined });
    const output = JSON.stringify(ErrorBoundary({ error, reset }));

    expect(output).toContain("An unexpected error occurred while rendering this page.");
  });

  it("offers a Try again recovery action", () => {
    const error = Object.assign(new Error("boom"), { digest: undefined });
    const output = JSON.stringify(ErrorBoundary({ error, reset }));

    expect(output).toContain("Try again");
  });

  it("wires the Try again button to the reset callback", () => {
    const error = Object.assign(new Error("boom"), { digest: undefined });
    const el = ErrorBoundary({ error, reset });
    const json = JSON.stringify(el);

    // The reset prop must be referenced somewhere in the rendered tree so
    // clicking the button calls it. Verify it appears as a bound onClick handler.
    expect(json).toContain("Try again");
    // Inspect the button's onClick directly from the element tree.
    const main = el as React.ReactElement<{ children: React.ReactNode }>;
    const children = (main.props as { children: React.ReactNode[] }).children;
    const buttonContainer = (children as React.ReactElement[]).find((c) =>
      JSON.stringify(c).includes("Try again"),
    );
    const buttons = (buttonContainer as React.ReactElement<{ children: React.ReactElement[] }>)
      .props.children;
    const tryAgainButton = (buttons as React.ReactElement[]).find((c) =>
      JSON.stringify(c).includes("Try again"),
    );
    expect(
      (tryAgainButton as React.ReactElement<{ onClick: () => void }>).props.onClick,
    ).toBe(reset);
  });

  it("offers a home navigation link as a secondary recovery action", () => {
    const error = Object.assign(new Error("boom"), { digest: undefined });
    const output = JSON.stringify(ErrorBoundary({ error, reset }));

    expect(output).toContain("Go to your streams");
    expect(output).toContain('href":"/"');
  });
});
