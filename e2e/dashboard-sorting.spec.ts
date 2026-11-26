import { test, expect } from "@playwright/test";

import { stubApi, stubChain, streamingStream, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

test("picks each sort option and checks the row order", async ({ page }) => {
  const now = Math.floor(Date.now() / 1000);

  const store: StreamStore = {
    streams: [
      streamingStream({
        id: "1",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        totalAmount: "5000000000", // 500
        endTime: String(now + 3600), // 1 hour
        progress: 2000, // 20%
        status: "streaming",
      }),
      streamingStream({
        id: "2",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        totalAmount: "10000000000", // 1000 (largest)
        endTime: String(now + 7200), // 2 hours
        progress: 8000, // 80%
        status: "streaming",
      }),
      streamingStream({
        id: "3",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        totalAmount: "2000000000", // 200
        endTime: String(now + 1800), // 30 minutes (soonest)
        progress: 9500, // 95% (most complete)
        status: "streaming",
      }),
      streamingStream({
        id: "4",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        totalAmount: "7500000000", // 750
        endTime: String(now + 5400), // 90 minutes
        progress: 5000, // 50%
        status: "streaming",
      }),
    ],
  };

  await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
  await stubApi(page, store);
  await stubChain(page, { address: TEST_ADDRESS });

  await page.goto("/");

  const incoming = page.locator("section").first();
  await expect(incoming.getByRole("link")).toHaveCount(4);

  // Default order (backend id descending: 1, 2, 3, 4)
  const defaultLinks = await incoming.getByRole("link").all();
  await expect(defaultLinks[0]).toHaveAccessibleName(/#1/);
  await expect(defaultLinks[1]).toHaveAccessibleName(/#2/);
  await expect(defaultLinks[2]).toHaveAccessibleName(/#3/);
  await expect(defaultLinks[3]).toHaveAccessibleName(/#4/);

  // Sort by ending soonest (ascending end time for active streams)
  await page.getByRole("combobox", { name: "Sort" }).selectOption("end-soonest");
  const endSoonestLinks = await incoming.getByRole("link").all();
  await expect(endSoonestLinks[0]).toHaveAccessibleName(/#3/); // 30 min
  await expect(endSoonestLinks[1]).toHaveAccessibleName(/#1/); // 1 hour
  await expect(endSoonestLinks[2]).toHaveAccessibleName(/#4/); // 90 min
  await expect(endSoonestLinks[3]).toHaveAccessibleName(/#2/); // 2 hours

  // Sort by amount largest first (descending total amount)
  await page.getByRole("combobox", { name: "Sort" }).selectOption("amount-largest");
  const amountLinks = await incoming.getByRole("link").all();
  await expect(amountLinks[0]).toHaveAccessibleName(/#2/); // 1000
  await expect(amountLinks[1]).toHaveAccessibleName(/#4/); // 750
  await expect(amountLinks[2]).toHaveAccessibleName(/#1/); // 500
  await expect(amountLinks[3]).toHaveAccessibleName(/#3/); // 200

  // Sort by progress most complete first (descending progress)
  await page.getByRole("combobox", { name: "Sort" }).selectOption("progress-most-complete");
  const progressLinks = await incoming.getByRole("link").all();
  await expect(progressLinks[0]).toHaveAccessibleName(/#3/); // 95%
  await expect(progressLinks[1]).toHaveAccessibleName(/#2/); // 80%
  await expect(progressLinks[2]).toHaveAccessibleName(/#4/); // 50%
  await expect(progressLinks[3]).toHaveAccessibleName(/#1/); // 20%
});

test("reloads and checks that the option and order survive", async ({ page }) => {
  const now = Math.floor(Date.now() / 1000);

  const store: StreamStore = {
    streams: [
      streamingStream({
        id: "1",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        totalAmount: "5000000000",
        endTime: String(now + 3600),
        status: "streaming",
      }),
      streamingStream({
        id: "2",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        totalAmount: "10000000000",
        endTime: String(now + 7200),
        status: "streaming",
      }),
      streamingStream({
        id: "3",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
        totalAmount: "2000000000",
        endTime: String(now + 1800),
        status: "streaming",
      }),
    ],
  };

  await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
  await stubApi(page, store);
  await stubChain(page, { address: TEST_ADDRESS });

  // Navigate with sort parameter in URL
  await page.goto("/?sort=amount-largest");

  const incoming = page.locator("section").first();
  await expect(incoming.getByRole("link")).toHaveCount(3);

  // Check that the sort option is selected
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("amount-largest");

  // Check that the order is correct (amount descending)
  const links = await incoming.getByRole("link").all();
  await expect(links[0]).toHaveAccessibleName(/#2/); // 1000
  await expect(links[1]).toHaveAccessibleName(/#1/); // 500
  await expect(links[2]).toHaveAccessibleName(/#3/); // 200

  // Reload the page
  await page.reload();

  // After reload, check sort option is still selected
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("amount-largest");

  // Check that order is still correct after reload
  const reloadedLinks = await incoming.getByRole("link").all();
  await expect(reloadedLinks[0]).toHaveAccessibleName(/#2/);
  await expect(reloadedLinks[1]).toHaveAccessibleName(/#1/);
  await expect(reloadedLinks[2]).toHaveAccessibleName(/#3/);
});

test("unknown sort value falls back to the default", async ({ page }) => {
  const store: StreamStore = {
    streams: [
      streamingStream({
        id: "1",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
      }),
      streamingStream({
        id: "2",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
      }),
      streamingStream({
        id: "3",
        sender: TEST_ADDRESS,
        recipient: TEST_ADDRESS,
      }),
    ],
  };

  await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
  await stubApi(page, store);
  await stubChain(page, { address: TEST_ADDRESS });

  // Navigate with an invalid sort parameter
  await page.goto("/?sort=invalid-sort-option");

  const incoming = page.locator("section").first();
  await expect(incoming.getByRole("link")).toHaveCount(3);

  // Check that the sort option falls back to default
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("default");

  // Check that the order is the default backend order (1, 2, 3)
  const links = await incoming.getByRole("link").all();
  await expect(links[0]).toHaveAccessibleName(/#1/);
  await expect(links[1]).toHaveAccessibleName(/#2/);
  await expect(links[2]).toHaveAccessibleName(/#3/);
});
