/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { simulateRead } = vi.hoisted(() => ({ simulateRead: vi.fn() }));

vi.mock("@/lib/contract-read", () => ({ simulateRead }));

import {
  clearTokenMetadataCache,
  getCachedTokenMetadata,
  KNOWN_TOKEN_METADATA,
  setCachedTokenMetadata,
  type TokenMetadata,
} from "@/lib/token-metadata";

import { useTokenMetadata } from "./use-token-metadata";

const UNKNOWN_TOKEN = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const ACCOUNT_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("useTokenMetadata", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;
  let latest: TokenMetadata | null;
  let renders: number;

  function Consumer({ token }: { token: string }) {
    latest = useTokenMetadata(token);
    renders += 1;
    return null;
  }

  async function renderToken(token: string) {
    await act(async () => {
      root.render(<Consumer token={token} />);
    });
  }

  // Lets every pending promise chain settle (real timers are in use here).
  async function flush() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  beforeEach(() => {
    clearTokenMetadataCache();
    simulateRead.mockReset();
    latest = null;
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

  it("returns cached metadata without reading the contract", async () => {
    const cached = { name: "Cached Coin", symbol: "CCN" };
    setCachedTokenMetadata(UNKNOWN_TOKEN, cached);

    await renderToken(UNKNOWN_TOKEN);

    expect(latest).toEqual(cached);
    expect(simulateRead).not.toHaveBeenCalled();
  });

  it("returns a known token from the fallback table without reading the contract", async () => {
    const [knownAddress, knownMetadata] = Object.entries(KNOWN_TOKEN_METADATA)[0];

    await renderToken(knownAddress);

    expect(latest).toEqual(knownMetadata);
    expect(simulateRead).not.toHaveBeenCalled();
  });

  it("starts null for an unknown token and updates once the lookup resolves", async () => {
    let resolveSymbol: (value: string) => void = () => {};
    simulateRead.mockImplementation((_id: string, method: string) =>
      method === "symbol"
        ? new Promise<string>((resolve) => {
            resolveSymbol = resolve;
          })
        : Promise.resolve("Token Name"),
    );

    await renderToken(UNKNOWN_TOKEN);
    expect(latest).toBeNull();

    await act(async () => {
      resolveSymbol("TKN");
    });
    await flush();

    expect(latest).toEqual({ symbol: "TKN", name: "Token Name" });
  });

  it("stays null when the lookup fails for an unknown token", async () => {
    simulateRead.mockRejectedValue(new Error("rpc unavailable"));

    await renderToken(UNKNOWN_TOKEN);
    await flush();

    expect(simulateRead).toHaveBeenCalled();
    expect(latest).toBeNull();
  });

  it("ignores a result that arrives after unmount", async () => {
    let resolveSymbol: (value: string) => void = () => {};
    simulateRead.mockImplementation((_id: string, method: string) =>
      method === "symbol"
        ? new Promise<string>((resolve) => {
            resolveSymbol = resolve;
          })
        : Promise.resolve("Token Name"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderToken(UNKNOWN_TOKEN);
    const rendersBeforeUnmount = renders;

    act(() => root.unmount());
    mounted = false;

    await act(async () => {
      resolveSymbol("LATE");
    });
    await flush();

    // The read itself still completes and is cached, but the unmounted hook
    // neither re-renders nor reports an error.
    expect(getCachedTokenMetadata(UNKNOWN_TOKEN)).toEqual({ symbol: "LATE", name: "Token Name" });
    expect(renders).toBe(rendersBeforeUnmount);
    expect(latest).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty string", ""],
    ["whitespace", "   "],
    ["free text", "not-a-contract"],
    ["an account address", ACCOUNT_ADDRESS],
  ])("returns null for %s", async (_label, address) => {
    await renderToken(address);
    await flush();

    expect(latest).toBeNull();
    expect(simulateRead).not.toHaveBeenCalled();
  });

  it("returns null again when a valid address is replaced by an invalid one", async () => {
    setCachedTokenMetadata(UNKNOWN_TOKEN, { name: "Cached Coin", symbol: "CCN" });
    await renderToken(UNKNOWN_TOKEN);
    expect(latest).toEqual({ name: "Cached Coin", symbol: "CCN" });

    await renderToken("not-a-contract");

    expect(latest).toBeNull();
  });
});
