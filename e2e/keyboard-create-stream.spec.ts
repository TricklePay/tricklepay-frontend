import { test, expect, type Locator, type Page } from "@playwright/test";
import { Keypair } from "@stellar/stellar-sdk";

import { TOKEN_ID, stubApi, stubChain, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

// Creating a stream with the keyboard alone, as described in
// docs/keyboard-shortcuts-and-focus.md. Every interaction below is a key press:
// Tab to reach a control, typing to fill it, Enter to activate it.

const RECIPIENT = Keypair.random().publicKey();

// Presses Tab until `target` has focus. Only ever moves forward, which matches
// the on-screen order, so a control that is out of order fails the test.
async function tabTo(page: Page, target: Locator, maxTabs = 40): Promise<void> {
  for (let presses = 0; presses < maxTabs; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

async function openCreateForm(page: Page) {
  const store: StreamStore = { streams: [] };

  await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
  await stubApi(page, store);
  const chain = await stubChain(page, { address: TEST_ADDRESS });

  await page.goto("/create");
  await expect(page.locator("#field-recipient")).toBeVisible();
  return chain;
}

test.describe("create a stream with only the keyboard", () => {
  test("fills, reviews and submits using key presses only", async ({ page }) => {
    const chain = await openCreateForm(page);

    await tabTo(page, page.locator("#field-recipient"));
    await page.keyboard.type(RECIPIENT);

    await tabTo(page, page.locator("#field-token"));
    await page.keyboard.type(TOKEN_ID);

    await tabTo(page, page.locator("#field-amount"));
    await page.keyboard.type("100");

    // "Use now" fills Start, which enables Duration; one day fills End.
    await tabTo(page, page.getByRole("button", { name: "Set start to the current time" }));
    await page.keyboard.press("Enter");
    await expect(page.locator("#field-start")).not.toHaveValue("");

    await tabTo(page, page.locator("#field-durationAmount"));
    await page.keyboard.type("1");
    await expect(page.locator("#field-end")).not.toHaveValue("");

    await tabTo(page, page.getByRole("button", { name: "Review stream" }));
    await page.keyboard.press("Enter");

    const review = page.getByRole("region", { name: "Review stream" });
    await expect(review).toBeVisible();
    await expect(review).toContainText("100");

    // Nothing is submitted until the review is confirmed.
    expect(chain.sendCount).toBe(0);

    await tabTo(page, review.getByRole("button", { name: "Confirm & create" }));
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/");
    await expect.poll(() => chain.sendCount).toBe(1);
  });

  test("moves focus to the first invalid field when submitting with errors", async ({ page }) => {
    await openCreateForm(page);

    // Valid addresses enable the submit button; the rest of the form is empty.
    await tabTo(page, page.locator("#field-recipient"));
    await page.keyboard.type(RECIPIENT);
    await tabTo(page, page.locator("#field-token"));
    await page.keyboard.type(TOKEN_ID);

    await tabTo(page, page.getByRole("button", { name: "Review stream" }));
    await page.keyboard.press("Enter");

    // Amount is the first empty required field.
    const amount = page.locator("#field-amount");
    await expect(page.getByText("Amount is required.")).toBeVisible();
    await expect(amount).toBeFocused();
    await expect(amount).toHaveAttribute("aria-invalid", "true");

    // Fix it from the keyboard; the next submit lands on Start instead.
    await page.keyboard.type("100");
    await expect(page.getByText("Amount is required.")).toHaveCount(0);

    await tabTo(page, page.getByRole("button", { name: "Review stream" }));
    await page.keyboard.press("Enter");

    await expect(page.getByText("Start date is required.")).toBeVisible();
    await expect(page.locator("#field-start")).toBeFocused();
  });
});
