/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/lib/theme";

import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeValue() {
  return <output data-theme={useTheme().theme} />;
}

describe("ThemeProvider", () => {
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

  it("applies the stored light preference on mount", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    document.documentElement.classList.add("light");

    await act(async () => {
      root.render(
        <ThemeProvider>
          <ThemeValue />
        </ThemeProvider>,
      );
    });

    expect(container.querySelector("output")?.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("defaults to dark when nothing is stored", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <ThemeValue />
        </ThemeProvider>,
      );
    });

    expect(container.querySelector("output")?.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});