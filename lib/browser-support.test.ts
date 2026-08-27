import { describe, expect, it } from "vitest";
import { isSupportedBrowser, SUPPORTED_DESKTOP_BROWSERS } from "./browser-support";

describe("browser support helper", () => {
  it("lists supported desktop browsers", () => {
    expect(SUPPORTED_DESKTOP_BROWSERS).toContain("Google Chrome");
    expect(SUPPORTED_DESKTOP_BROWSERS).toContain("Mozilla Firefox");
    expect(SUPPORTED_DESKTOP_BROWSERS).toContain("Brave Browser");
    expect(SUPPORTED_DESKTOP_BROWSERS).toContain("Microsoft Edge");
  });

  it("identifies desktop browsers as supported", () => {
    const chromeUA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const firefoxUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0";
    const edgeUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";

    expect(isSupportedBrowser(chromeUA)).toBe(true);
    expect(isSupportedBrowser(firefoxUA)).toBe(true);
    expect(isSupportedBrowser(edgeUA)).toBe(true);
  });

  it("identifies mobile devices as not supporting desktop wallet extension", () => {
    const iphoneUA =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
    const androidUA =
      "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36";

    expect(isSupportedBrowser(iphoneUA)).toBe(false);
    expect(isSupportedBrowser(androidUA)).toBe(false);
  });
});
