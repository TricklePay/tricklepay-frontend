import { test, expect } from "@playwright/test";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";
import { TOKEN_ID, stubApi, stubChain, type StreamStore } from "./fixtures/chain";

test.describe("Create Stream Form Validation", () => {
  test("shows field validation errors for invalid inputs and prevents review submit", async ({
    page,
  }) => {
    const store: StreamStore = { streams: [] };

    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    await stubChain(page, { address: TEST_ADDRESS });

    await page.goto("/create");

    // Submit without filling fields -> validation errors surface
    await page.getByRole("button", { name: "Review stream" }).click();

    await expect(page.getByText("Must be a valid G... or C... Stellar address.")).toBeVisible();
    await expect(page.getByText("Must be a valid C... contract address.")).toBeVisible();
    await expect(page.getByText("Start date is required.")).toBeVisible();
    await expect(page.getByText("End date is required.")).toBeVisible();

    // Verify recipient field error clears when valid G... address is typed
    await page.getByLabel("Recipient address").fill(TEST_ADDRESS);
    await expect(
      page.getByText("Must be a valid G... or C... Stellar address."),
    ).not.toBeVisible();

    // Verify token error clears when valid C... address is typed
    await page.getByLabel("Token contract id").fill(TOKEN_ID);
    await expect(page.getByText("Must be a valid C... contract address.")).not.toBeVisible();

    // Verify invalid amount (>7 decimals) shows explicit error
    await page.getByLabel("Amount").fill("100.12345678");
    await expect(page.getByText("Amount cannot have more than 7 decimal places.")).toBeVisible();

    // Fix amount to valid decimal
    await page.getByLabel("Amount").fill("100.5");
    await expect(
      page.getByText("Amount cannot have more than 7 decimal places."),
    ).not.toBeVisible();

    // Verify end date before start date error
    const now = new Date();
    const futureStart = new Date(now.getTime() + 60_000);
    const pastEnd = new Date(now.getTime() - 60_000);

    const toLocalInput = (d: Date) => d.toISOString().slice(0, 16);

    await page.getByLabel("Start").fill(toLocalInput(futureStart));
    await page.getByLabel("End", { exact: true }).fill(toLocalInput(pastEnd));
    await expect(page.getByText("End must be after start.")).toBeVisible();

    // Fix end date to after start
    const validEnd = new Date(now.getTime() + 120_000);
    await page.getByLabel("End", { exact: true }).fill(toLocalInput(validEnd));
    await expect(page.getByText("End must be after start.")).not.toBeVisible();

    // Verify review button works after fixing all fields
    await page.getByRole("button", { name: "Review stream" }).click();
    await expect(page.getByRole("region", { name: "Review stream" })).toBeVisible();
  });
});
