/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/lib/theme";

import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.documentElement.classList.remove("light");
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("switches themes and persists the selection", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>,
      );
    });

    const toggle = () => container.querySelector("button")?.click();
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Switch to light theme");

    await act(async () => toggle());

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Switch to dark theme");

    await act(async () => toggle());

    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});