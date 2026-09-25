import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Execute useEffect synchronously so the hook's addEventListener /
// removeEventListener calls happen inline, without a React tree or jsdom.
// The factory returns a cleanup function so teardown tests can capture it.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: vi.fn((fn: () => (() => void) | void) => fn()),
  };
});

import { useEffect } from "react";
import { useFormNavigationWarning } from "./use-form-navigation-warning";

describe("useFormNavigationWarning", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("arms the beforeunload listener when the form has unsaved input", () => {
    useFormNavigationWarning(true);

    expect(addSpy).toHaveBeenCalledOnce();
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("does not arm the listener for an untouched form", () => {
    useFormNavigationWarning(false);

    expect(addSpy).not.toHaveBeenCalled();
  });

  it("uses the default warning message", () => {
    let registeredHandler: ((e: BeforeUnloadEvent) => void) | undefined;
    addSpy.mockImplementation((_type, handler) => {
      registeredHandler = handler as (e: BeforeUnloadEvent) => void;
    });

    useFormNavigationWarning(true);

    const fakeEvent = { preventDefault: vi.fn(), returnValue: "" } as unknown as BeforeUnloadEvent;
    registeredHandler!(fakeEvent);

    expect(fakeEvent.returnValue).toBe(
      "You have unsaved changes. Leaving this page will discard them.",
    );
  });

  it("uses a supplied custom message instead of the default", () => {
    let registeredHandler: ((e: BeforeUnloadEvent) => void) | undefined;
    addSpy.mockImplementation((_type, handler) => {
      registeredHandler = handler as (e: BeforeUnloadEvent) => void;
    });

    useFormNavigationWarning(true, "All progress will be lost.");

    const fakeEvent = { preventDefault: vi.fn(), returnValue: "" } as unknown as BeforeUnloadEvent;
    registeredHandler!(fakeEvent);

    expect(fakeEvent.returnValue).toBe("All progress will be lost.");
  });

  it("removes the listener on effect cleanup", () => {
    // Capture the cleanup returned by the effect so we can invoke it directly,
    // simulating what React does when the component unmounts or deps change.
    let cleanup: (() => void) | undefined;
    vi.mocked(useEffect).mockImplementationOnce((fn) => {
      cleanup = (fn() ?? undefined) as (() => void) | undefined;
    });

    useFormNavigationWarning(true);
    cleanup?.();

    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
