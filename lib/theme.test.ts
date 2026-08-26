import { describe, expect, it } from "vitest";
import { otherTheme, resolveInitialTheme } from "@/lib/theme";

describe("resolveInitialTheme", () => {
  it("uses the persisted choice when present, regardless of OS preference", () => {
    expect(resolveInitialTheme("light", false)).toBe("light");
    expect(resolveInitialTheme("dark", true)).toBe("dark");
  });

  it("falls back to the OS preference when nothing is persisted", () => {
    expect(resolveInitialTheme(null, true)).toBe("light");
    expect(resolveInitialTheme(null, false)).toBe("dark");
  });

  it("falls back to the OS preference when the persisted value is invalid", () => {
    expect(resolveInitialTheme("blue", true)).toBe("light");
    expect(resolveInitialTheme("", false)).toBe("dark");
  });
});

describe("otherTheme", () => {
  it("flips between light and dark", () => {
    expect(otherTheme("light")).toBe("dark");
    expect(otherTheme("dark")).toBe("light");
  });
});
