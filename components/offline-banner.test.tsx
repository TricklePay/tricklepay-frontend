/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOnline } from "@/hooks/use-online";

import { OfflineBanner } from "./offline-banner";

vi.mock("@/hooks/use-online", () => ({
  useOnline: vi.fn(),
}));

describe("OfflineBanner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders an empty polite live region when online", () => {
    vi.mocked(useOnline).mockReturnValue(true);

    act(() => {
      root.render(<OfflineBanner />);
    });

    const region = container.querySelector('[role="status"]');
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("aria-atomic")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("");
    expect(region?.textContent).toBe("");
  });

  it("announces the offline message without a dismiss control when offline", () => {
    vi.mocked(useOnline).mockReturnValue(false);

    act(() => {
      root.render(<OfflineBanner />);
    });

    const region = container.querySelector('[role="status"]');
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("aria-atomic")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("You are offline");
    expect(region?.textContent).toBe(
      "You are offline. Check your connection — data will refresh when connectivity returns.",
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("toggles the message when connectivity changes, keeping the same live region", () => {
    vi.mocked(useOnline).mockReturnValue(true);

    act(() => {
      root.render(<OfflineBanner />);
    });
    const region = container.querySelector('[role="status"]');
    expect(region?.textContent).toBe("");

    // Connectivity drops: the message appears inside the same region element.
    vi.mocked(useOnline).mockReturnValue(false);
    act(() => {
      root.render(<OfflineBanner />);
    });
    expect(container.querySelector('[role="status"]')).toBe(region);
    expect(region?.textContent).toContain("You are offline.");

    // Connectivity returns: the message is removed, the region stays.
    vi.mocked(useOnline).mockReturnValue(true);
    act(() => {
      root.render(<OfflineBanner />);
    });
    expect(container.querySelector('[role="status"]')).toBe(region);
    expect(region?.textContent).toBe("");
  });
});
