// End-to-end coverage for the wrong-network guard (#320).
//
// The guard is security-relevant: signing on the wrong network would produce
// a transaction the RPC rejects, or worse, one that lands on the wrong chain.
// This suite drives the guard with a stubbed wallet on PUBLIC while the app
// is configured for testnet, and asserts that:
//   1. signing is refused before any wallet prompt,
//   2. the error message names both networks,
//   3. no transaction is ever submitted.

import { test, expect } from "@playwright/test";

import { TOKEN_ID, stubApi, stubChain, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

const VALID_RECIPIENT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

async function fillValidCreateForm(page: import("@playwright/test").Page) {
  await page.goto("/create");
  await page.getByLabel("Recipient address").fill(VALID_RECIPIENT);
  await page.getByLabel("Token contract id").fill(TOKEN_ID);
  await page.getByLabel("Amount").fill("100.5");

  const now = new Date();
  const start = new Date(now.getTime() + 60_000);
  const end = new Date(now.getTime() + 3_600_000);
  const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);
  await page.getByLabel("Start").fill(toLocalInput(start));
  await page.getByLabel("End", { exact: true }).fill(toLocalInput(end));

  await page.getByRole("button", { name: "Review stream" }).click();
  await expect(page.getByRole("region", { name: "Review stream" })).toBeVisible();
}

test.describe("Wrong network guard (e2e — #320)", () => {
  test("refuses to sign when the wallet is on another network, naming both networks", async ({
    page,
  }) => {
    const store: StreamStore = { streams: [] };

    // Wallet stubbed on PUBLIC (mainnet); app is configured for testnet.
    await page.addInitScript(installFreighterStub, {
      address: TEST_ADDRESS,
      network: "PUBLIC",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });
    await stubApi(page, store);
    await stubChain(page, { address: TEST_ADDRESS });

    await fillValidCreateForm(page);

    // Confirm on the review step — this is where the transaction would be built.
    const confirmButton = page.getByRole("button", { name: /confirm|create|sign/i });
    await confirmButton.first().click();

    // The guard must surface an error that names BOTH networks.
    // App expects testnet; wallet is on public/mainnet.
    const wrongNetworkText = page.getByText(/wrong network/i);
    await expect(wrongNetworkText).toBeVisible({ timeout: 15_000 });

    const message = await wrongNetworkText.first().textContent();
    expect(message).toBeTruthy();
    const lower = message!.toLowerCase();
    // Names the wallet's network (public / mainnet)
    expect(lower).toMatch(/public|mainnet/);
    // Names the app's expected network (testnet)
    expect(lower).toMatch(/testnet/);

    // Signing was refused: nothing was submitted to the wallet stub.
    const signed = await page.evaluate(
      () => (window as unknown as { __signedTransactions?: string[] }).__signedTransactions ?? [],
    );
    expect(signed).toHaveLength(0);
  });

  test("wallet-button surfaces the mismatch banner naming both networks", async ({ page }) => {
    await page.addInitScript(installFreighterStub, {
      address: TEST_ADDRESS,
      network: "PUBLIC",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });

    // Wallet status UI reads useNetworkGuard; with a PUBLIC wallet and a
    // testnet app config the banner must appear.
    await page.goto("/");
    // The banner copy comes from wrongNetworkMessage / WalletStatusBadge.
    // Give the provider a moment to hydrate the wallet network.
    await expect(page.getByText(/wrong network/i)).toBeVisible({ timeout: 15_000 });

    const banner = await page.getByText(/wrong network/i).first().textContent();
    expect(banner!.toLowerCase()).toMatch(/public|mainnet/);
    expect(banner!.toLowerCase()).toMatch(/testnet/);
  });

  test("does not refuse when the wallet is on the expected network", async ({ page }) => {
    const store: StreamStore = { streams: [] };

    // Wallet on TESTNET — matches app config; guard must not fire.
    await page.addInitScript(installFreighterStub, {
      address: TEST_ADDRESS,
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    await stubApi(page, store);
    await stubChain(page, { address: TEST_ADDRESS });

    await fillValidCreateForm(page);

    // No wrong-network error should appear on the review step.
    await expect(page.getByText(/wrong network/i)).not.toBeVisible();
  });
});
