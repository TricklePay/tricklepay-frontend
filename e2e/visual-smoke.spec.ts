import { test, expect } from "@playwright/test";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";
import { stubApi, stubChain, type StreamStore } from "./fixtures/chain";

test.describe("Visual Regression Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    const store: StreamStore = { streams: [] };
    await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
    await stubApi(page, store);
    await stubChain(page, { address: TEST_ADDRESS });
  });

  test("dashboard page renders clean responsive layout without visual shifts", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify key header, navigation, and dashboard regions exist
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();

    // Verify wallet status indicator button is rendered
    await expect(page.getByRole("button", { name: /GAAZ|\.\.\./ })).toBeVisible();

    // Take screenshot snapshot for visual regression baseline comparison
    await expect(page).toHaveScreenshot("dashboard-smoke.png", {
      maxDiffPixelRatio: 0.05,
    });
  });

  test("create stream page renders form fields and actions in desktop and mobile viewports", async ({
    page,
  }) => {
    await page.goto("/create");

    await expect(page.getByLabel("Recipient address")).toBeVisible();
    await expect(page.getByLabel("Token contract id")).toBeVisible();
    await expect(page.getByLabel("Amount")).toBeVisible();

    // Snapshot of create page
    await expect(page).toHaveScreenshot("create-stream-smoke.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Verify mobile responsive layout (375x667 viewport)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole("button", { name: "Review stream" })).toBeVisible();
    await expect(page).toHaveScreenshot("create-stream-mobile-smoke.png", {
      maxDiffPixelRatio: 0.05,
    });
  });
});
