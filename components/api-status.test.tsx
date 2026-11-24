/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useApiHealth } from "@/hooks/use-api-health";

import { ApiStatus } from "./api-status";

const mockConfig = vi.hoisted(() => ({ mockApi: false }));

vi.mock("@/hooks/use-api-health", () => ({
  useApiHealth: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: mockConfig,
}));

describe("ApiStatus", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderStatus() {
    act(() => {
      root.render(<ApiStatus />);
    });
  }

  beforeEach(() => {
    mockConfig.mockApi = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders nothing while the first check is still running", () => {
    vi.mocked(useApiHealth).mockReturnValue("checking");

    renderStatus();

    expect(container.innerHTML).toBe("");
  });

  it("renders nothing in mock mode, even when a health value is available", () => {
    mockConfig.mockApi = true;
    vi.mocked(useApiHealth).mockReturnValue("reachable");

    renderStatus();

    expect(container.innerHTML).toBe("");
    // The probe is disabled in mock mode because there is no backend.
    expect(useApiHealth).toHaveBeenCalledWith(false);
  });

  it("shows a status dot with screen reader text when the API is reachable", () => {
    vi.mocked(useApiHealth).mockReturnValue("reachable");

    renderStatus();

    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("data-api-health")).toBe("reachable");
    expect(status?.querySelector(".sr-only")?.textContent).toBe("API reachable");
    expect(status?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(useApiHealth).toHaveBeenCalledWith(true);
  });

  it("shows a status dot with screen reader text when the API is unreachable", () => {
    vi.mocked(useApiHealth).mockReturnValue("unreachable");

    renderStatus();

    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute("data-api-health")).toBe("unreachable");
    expect(status?.querySelector(".sr-only")?.textContent).toBe("API unreachable");
  });
});
