/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUserAgent } from "./use-user-agent";

function Consumer({ onRender }: { onRender: (userAgent: string | null) => void }) {
  onRender(useUserAgent());
  return null;
}

describe("useUserAgent", () => {
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
  });

  it("returns null during server rendering", () => {
    const renders: (string | null)[] = [];
    // renderToString simulates server-side rendering where navigator is unavailable
    renderToString(<Consumer onRender={(v) => renders.push(v)} />);
    expect(renders.at(-1)).toBe(null);
  });

  it("returns the navigator user agent after mount", () => {
    const renders: (string | null)[] = [];
    act(() => {
      root.render(<Consumer onRender={(v) => renders.push(v)} />);
    });
    expect(renders.at(-1)).toBe(navigator.userAgent);
  });

  it("returns null while hydrating and the user agent after", () => {
    // A plain client render reads the real value straight away. The server
    // snapshot (null) is only used while hydrating server-rendered markup.
    const hydrationContainer = document.createElement("div");
    document.body.appendChild(hydrationContainer);
    hydrationContainer.innerHTML = renderToString(<Consumer onRender={() => {}} />);

    const renders: (string | null)[] = [];
    let hydrated: Root | undefined;
    act(() => {
      hydrated = hydrateRoot(hydrationContainer, <Consumer onRender={(v) => renders.push(v)} />);
    });

    expect(renders[0]).toBe(null);
    expect(renders.at(-1)).toBe(navigator.userAgent);

    act(() => hydrated?.unmount());
    hydrationContainer.remove();
  });

  it("checks the behaviour when navigator is unavailable", () => {
    const originalNavigator = global.navigator;
    // @ts-expect-error: Temporarily removing navigator to test fallback behavior
    delete global.navigator;

    const renders: (string | null)[] = [];
    // This should not throw and should return null
    expect(() => {
      renderToString(<Consumer onRender={(v) => renders.push(v)} />);
    }).not.toThrow();
    expect(renders.at(-1)).toBe(null);

    // Restore navigator
    global.navigator = originalNavigator;
  });

  it("does not change between renders after mount", () => {
    const renders: (string | null)[] = [];
    act(() => {
      root.render(<Consumer onRender={(v) => renders.push(v)} />);
    });

    const firstClientRender = renders.at(-1);

    // Force a re-render by updating props
    act(() => {
      root.render(<Consumer onRender={(v) => renders.push(v)} />);
    });

    // The user agent should be the same value
    expect(renders.at(-1)).toBe(firstClientRender);
    expect(renders.at(-1)).toBe(navigator.userAgent);
  });

  it("returns a string on the client", () => {
    const renders: (string | null)[] = [];
    act(() => {
      root.render(<Consumer onRender={(v) => renders.push(v)} />);
    });
    const clientValue = renders.at(-1);
    expect(typeof clientValue).toBe("string");
    expect(clientValue).toBeTruthy();
  });
});
