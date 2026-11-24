import { test, expect, type Page } from "@playwright/test";

import { stubApi, stubChain, streamingStream, type StreamStore } from "./fixtures/chain";
import { installFreighterStub, TEST_ADDRESS } from "./fixtures/freighter";

// Colour contrast needs real layout and painting, which jsdom does not do, so
// the page-level axe tests in app/a11y.axe.test.tsx leave it off. This runs just
// that rule in the browser against each page.

const PAGES = [
  { name: "dashboard", path: "/" },
  { name: "create", path: "/create" },
  { name: "stream detail", path: "/streams/1" },
];

async function contrastViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[] }> }> }> } }).axe;
    const { violations } = await axe.run(document, { runOnly: ["color-contrast"] });
    return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  });
}

test.describe("colour contrast", () => {
  for (const { name, path } of PAGES) {
    test(`${name} page has no contrast violations`, async ({ page }) => {
      const store: StreamStore = {
        streams: [streamingStream({ id: "1", sender: TEST_ADDRESS, recipient: TEST_ADDRESS })],
      };
      await page.addInitScript(installFreighterStub, { address: TEST_ADDRESS });
      await stubApi(page, store);
      await stubChain(page, { address: TEST_ADDRESS });

      await page.goto(path);
      await page.locator("main").waitFor();
      expect(await contrastViolations(page)).toEqual([]);
    });
  }
});
