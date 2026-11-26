/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { readTokenDecimals: readTokenDecimalsMock } = vi.hoisted(() => ({
  readTokenDecimals: vi.fn(),
}));

vi.mock("@/lib/token-decimals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/token-decimals")>();
  return {
    ...actual,
    readTokenDecimals: readTokenDecimalsMock,
  };
});

import {
  clearTokenDecimalsCache,
  getCachedTokenDecimals,
  setCachedTokenDecimals,
} from "@/lib/token-decimals";

import { useTokenDecimals } from "./use-token-decimals";

const TOKEN_A = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const TOKEN_B = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const ACCOUNT_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("useTokenDecimals", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;
  let renders: number;

  function Consumer({ tokens }: { tokens: readonly string[] }) {
    useTokenDecimals(tokens);
    renders += 1;
    return null;
  }

  async function renderTokens(tokens: readonly string[]) {
    await act(async () => {
      root.render(<Consumer tokens={tokens} />);
    });
  }

  // Lets every pending promise chain settle (real timers are in use here).
  async function flush() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  beforeEach(() => {
    clearTokenDecimalsCache();
    readTokenDecimalsMock.mockReset();
    renders = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mounted = true;
  });

  afterEach(() => {
    if (mounted) act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("does not read decimals for cached tokens", async () => {
    setCachedTokenDecimals(TOKEN_A, 6);

    await renderTokens([TOKEN_A]);

    expect(readTokenDecimalsMock).not.toHaveBeenCalled();
    expect(getCachedTokenDecimals(TOKEN_A)).toBe(6);
  });

  it("reads decimals for uncached tokens and re-renders when they arrive", async () => {
    let resolveDecimals: (value: number) => void = () => {};
    readTokenDecimalsMock.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveDecimals = resolve;
      }),
    );

    await renderTokens([TOKEN_A]);
    const rendersBeforeResolve = renders;

    await act(async () => {
      resolveDecimals(6);
    });
    await flush();

    expect(readTokenDecimalsMock).toHaveBeenCalledWith(TOKEN_A);
    expect(renders).toBeGreaterThan(rendersBeforeResolve);
    expect(getCachedTokenDecimals(TOKEN_A)).toBe(6);
  });

  it("ignores failures when RPC cannot resolve the token", async () => {
    readTokenDecimalsMock.mockRejectedValue(new Error("rpc unavailable"));

    await renderTokens([TOKEN_A]);
    await flush();

    expect(readTokenDecimalsMock).toHaveBeenCalledWith(TOKEN_A);
    expect(getCachedTokenDecimals(TOKEN_A)).toBeNull();
    // The hook should not throw or crash on failure.
  });

  it("skips invalid contract addresses", async () => {
    await renderTokens([ACCOUNT_ADDRESS, "not-a-contract", "", "   "]);
    await flush();

    expect(readTokenDecimalsMock).not.toHaveBeenCalled();
  });

  it("does not update state after unmount", async () => {
    let resolveDecimals: (value: number) => void = () => {};
    readTokenDecimalsMock.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveDecimals = resolve;
      }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderTokens([TOKEN_A]);
    const rendersBeforeUnmount = renders;

    act(() => root.unmount());
    mounted = false;

    await act(async () => {
      resolveDecimals(6);
    });
    await flush();

    // The read completes and is cached, but the unmounted hook does not re-render.
    expect(getCachedTokenDecimals(TOKEN_A)).toBe(6);
    expect(renders).toBe(rendersBeforeUnmount);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("reads multiple uncached tokens concurrently", async () => {
    readTokenDecimalsMock.mockImplementation((token: string) =>
      token === TOKEN_A ? Promise.resolve(6) : Promise.resolve(8),
    );

    await renderTokens([TOKEN_A, TOKEN_B]);
    await flush();

    expect(readTokenDecimalsMock).toHaveBeenCalledWith(TOKEN_A);
    expect(readTokenDecimalsMock).toHaveBeenCalledWith(TOKEN_B);
    expect(getCachedTokenDecimals(TOKEN_A)).toBe(6);
    expect(getCachedTokenDecimals(TOKEN_B)).toBe(8);
  });

  it("deduplicates tokens in the input array", async () => {
    setCachedTokenDecimals(TOKEN_A, 6);

    await renderTokens([TOKEN_A, TOKEN_A, `  ${TOKEN_A}  `]);
    await flush();

    expect(readTokenDecimalsMock).not.toHaveBeenCalled();
  });

  it("re-runs effect when the token list changes", async () => {
    setCachedTokenDecimals(TOKEN_A, 6);

    await renderTokens([TOKEN_A]);
    expect(readTokenDecimalsMock).not.toHaveBeenCalled();

    readTokenDecimalsMock.mockResolvedValue(8);
    await renderTokens([TOKEN_B]);
    await flush();

    expect(readTokenDecimalsMock).toHaveBeenCalledWith(TOKEN_B);
    expect(getCachedTokenDecimals(TOKEN_B)).toBe(8);
  });
});
