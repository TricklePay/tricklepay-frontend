import { test, expect } from "@playwright/test";

import { stubApi, stubChain, streamingStream, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

test("loads another page of streams from the dashboard", async ({ page }) => {
  const store: StreamStore = {
    streams: Array.from({ length: 26 }, (_, index) =>
      streamingStream({
        id: String(index + 1),
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
      }),
    ),
  };

  await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
  await stubApi(page, store);
  await stubChain(page, { address: TEST_ADDRESS });

  const incomingOffsets: number[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/streams" && url.searchParams.get("recipient") === TEST_ADDRESS) {
      incomingOffsets.push(Number(url.searchParams.get("offset")));
    }
  });

  await page.goto("/");

  const incoming = page.locator("section").first();
  await expect(incoming.getByRole("link")).toHaveCount(25);
  await expect(incoming.getByRole("link", { name: /#26/ })).toHaveCount(0);
  await expect(incoming.getByRole("button", { name: "Load more (1 remaining)" })).toBeVisible();

  await incoming.getByRole("button", { name: "Load more (1 remaining)" }).click();

  await expect.poll(() => incomingOffsets).toEqual([0, 25]);
  await expect(incoming.getByRole("link")).toHaveCount(26);
  await expect(incoming.getByRole("link", { name: /#26/ })).toBeVisible();
  await expect(incoming.getByRole("button", { name: /Load more/ })).toHaveCount(0);
});