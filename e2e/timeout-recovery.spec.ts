import { test, expect } from "@playwright/test";
import { Keypair } from "@stellar/stellar-sdk";

import { stubApi, stubChain, streamingStream, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

const RECIPIENT = Keypair.random().publicKey();

test("re-checks a transaction after confirmation times out", async ({ page }) => {
  test.slow();

  const store: StreamStore = {
    streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: RECIPIENT })],
  };
  const confirmationStatuses = [
    ...Array.from({ length: 30 }, () => "PENDING" as const),
    "SUCCESS" as const,
  ];

  await page.clock.install();
  await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
  await stubApi(page, store);
  const chain = await stubChain(page, { address: TEST_ADDRESS, confirmationStatuses });

  await page.goto("/streams/1");
  await page.getByRole("button", { name: "Cancel stream", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel stream" }).click();

  await expect.poll(() => chain.methods.filter((method) => method === "getTransaction").length).toBe(1);
  await expect(page.getByRole("status", { name: "Transaction progress" })).toContainText("Confirming");
  await page.clock.runFor("00:30");
  await expect.poll(() => chain.methods.filter((method) => method === "getTransaction").length).toBe(30);

  const alert = page.getByRole("alert").filter({ hasText: "Transaction confirmation timed out" });
  await expect(alert).toContainText("Transaction confirmation timed out");
  await expect(alert.getByRole("button", { name: "Re-check status" })).toBeVisible();

  await alert.getByRole("button", { name: "Re-check status" }).click();

  await expect.poll(() => chain.methods.filter((method) => method === "getTransaction").length).toBe(31);
  await expect(alert).toHaveCount(0);
  await expect(page.getByText("Confirmed.")).toBeVisible();
  expect(chain.sendCount).toBe(1);
});