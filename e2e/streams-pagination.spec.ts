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

  const incomingCursors: Array<string | null> = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/streams" && url.searchParams.get("recipient") === TEST_ADDRESS) {
      incomingCursors.push(url.searchParams.get("cursor"));
    }
  });

  await page.goto("/");

  const incoming = page.locator("section").first();
  await expect(incoming.getByRole("link")).toHaveCount(25);
  await expect(incoming.getByRole("link", { name: /#26/ })).toHaveCount(0);
  await expect(incoming.getByRole("button", { name: "Load more (1 remaining)" })).toBeVisible();

  await incoming.getByRole("button", { name: "Load more (1 remaining)" }).click();

  await expect.poll(() => incomingCursors).toEqual([null, "25"]);
  await expect(incoming.getByRole("link")).toHaveCount(26);
  await expect(incoming.getByRole("link", { name: /#26/ })).toBeVisible();
  await expect(incoming.getByRole("button", { name: /Load more/ })).toHaveCount(0);
});

test("rejects undocumented query parameters with 400 and omits total without includeTotal", async ({ page }) => {
  const store: StreamStore = { streams: [] };
  await stubApi(page, store);

  await page.goto("/");
  const results = await page.evaluate(async () => {
    const queries = ["?status=streaming", "", "?includeTotal=true"];
    return Promise.all(queries.map(async (query) => {
      const response = await fetch(`http://localhost:3000/streams${query}`);
      const body = await response.json();
      return { status: response.status, total: body.total };
    }));
  });

  expect(results).toEqual([
    { status: 400, total: undefined },
    { status: 200, total: undefined },
    { status: 200, total: 0 },
  ]);
});
test("filters loaded streams by status and keeps the backend cursor", async ({ page }) => {
  const statuses = ["streaming", "completed", "cancelled"] as const;
  const store: StreamStore = {
    streams: Array.from({ length: 26 }, (_, index) =>
      streamingStream({
        id: String(index + 1),
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        status: index === 25 ? "pending" : statuses[index % statuses.length],
      }),
    ),
  };
  await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
  await stubApi(page, store);
  await stubChain(page, { address: TEST_ADDRESS });
  await page.goto("/");

  const incoming = page.locator("section").first();
  await expect(incoming.getByRole("link")).toHaveCount(25);
  for (const [label, id, count] of [
    ["Streaming", "1", 9],
    ["Completed", "2", 8],
    ["Cancelled", "3", 8],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(incoming.getByRole("link", { name: `#${id}`, exact: true })).toBeVisible();
    await expect(incoming.getByRole("link")).toHaveCount(count);
  }

  await page.getByRole("button", { name: "Pending", exact: true }).click();
  await expect(incoming.getByText("No pending streams in the loaded results.")).toBeVisible();
  await incoming.getByRole("button", { name: "Load more (1 unfiltered remaining)" }).click();
  await expect(incoming.getByRole("link", { name: /#26/ })).toBeVisible();
  await expect(incoming.getByText("1 matching loaded")).toBeVisible();
  await expect(incoming.getByRole("button", { name: /Load more/ })).toHaveCount(0);
});
