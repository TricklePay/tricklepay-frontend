/* @vitest-environment jsdom */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ACCOUNT_NOT_FOUND_MESSAGE, friendbotUrl } from "@/lib/contract-messages";

import { AccountNotFoundAlert } from "./account-not-found-alert";

const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("AccountNotFoundAlert", () => {
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

  function render(isTestnet: boolean) {
    act(() => {
      root.render(<AccountNotFoundAlert address={ADDRESS} isTestnet={isTestnet} />);
    });
  }

  it("shows the Friendbot link on testnet with safe new-tab attributes", () => {
    render(true);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(friendbotUrl(ADDRESS));
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toContain("Fund this account with Friendbot");
    expect(link?.textContent).toContain("(opens in a new tab)");
  });

  it("does not show the Friendbot link on mainnet", () => {
    render(false);

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain(ACCOUNT_NOT_FOUND_MESSAGE);
  });

  it.each([true, false])("renders role=alert when isTestnet is %s", (isTestnet) => {
    render(isTestnet);

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain("Account not funded");
  });
});
