/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "./copy-button";

describe("CopyButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("writes the value to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    act(() => {
      root.render(<CopyButton value="GABC" label="address" />);
    });

    await act(async () => {
      container.querySelector("button")?.click();
    });

    expect(writeText).toHaveBeenCalledWith("GABC");
  });

  it("shows confirmation and clears it after the feedback period", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    act(() => {
      root.render(<CopyButton value="GABC" label="address" />);
    });

    await act(async () => {
      container.querySelector("button")?.click();
    });
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Copied address");

    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Copy address");
  });
});