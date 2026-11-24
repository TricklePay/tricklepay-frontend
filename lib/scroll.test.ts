/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearReturningFromStream,
  getSavedDashboardScroll,
  isReturningFromStream,
  markNavigatingToStream,
  saveDashboardScroll,
} from "./scroll";

const SCROLL_KEY = (search: string) => `tricklepay:scroll_pos:${search}`;
const FROM_STREAM_KEY = "tricklepay:from_stream_detail";

describe("scroll position helpers", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  describe("save and restore", () => {
    it("saves the current scroll position and restores it", () => {
      (window as { scrollY: number }).scrollY = 420;

      saveDashboardScroll();

      expect(sessionStorage.getItem(SCROLL_KEY(""))).toBe("420");
      expect(getSavedDashboardScroll()).toBe(420);
    });

    it("keeps a separate position per query string", () => {
      (window as { scrollY: number }).scrollY = 100;
      saveDashboardScroll("?status=streaming");
      (window as { scrollY: number }).scrollY = 900;
      saveDashboardScroll("?status=completed");

      expect(getSavedDashboardScroll("?status=streaming")).toBe(100);
      expect(getSavedDashboardScroll("?status=completed")).toBe(900);
      expect(getSavedDashboardScroll("?status=cancelled")).toBeNull();
    });

    it("returns null when nothing was saved", () => {
      expect(getSavedDashboardScroll()).toBeNull();
    });
  });

  describe("invalid values", () => {
    it("returns null for a stored value that is not a number", () => {
      sessionStorage.setItem(SCROLL_KEY(""), "not-a-number");

      expect(getSavedDashboardScroll()).toBeNull();
    });

    it("parses the leading integer of a numeric string", () => {
      sessionStorage.setItem(SCROLL_KEY(""), "250.9px");

      expect(getSavedDashboardScroll()).toBe(250);
    });
  });

  describe("storage errors", () => {
    it("returns null instead of throwing when reading storage fails", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage disabled");
      });

      expect(getSavedDashboardScroll()).toBeNull();
      expect(isReturningFromStream()).toBe(false);
    });

    it("does not throw when writing or removing fails", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("storage disabled");
      });

      expect(() => saveDashboardScroll("?a=1")).not.toThrow();
      expect(() => markNavigatingToStream("?a=1")).not.toThrow();
      expect(() => clearReturningFromStream()).not.toThrow();
    });
  });

  describe("returning-from-stream flag", () => {
    it("is not set by default", () => {
      expect(isReturningFromStream()).toBe(false);
    });

    it("is set, together with the scroll position, when navigating to a stream", () => {
      (window as { scrollY: number }).scrollY = 640;

      markNavigatingToStream("?page=2");

      expect(sessionStorage.getItem(FROM_STREAM_KEY)).toBe("true");
      expect(isReturningFromStream()).toBe(true);
      expect(getSavedDashboardScroll("?page=2")).toBe(640);
    });

    it("is cleared by clearReturningFromStream", () => {
      markNavigatingToStream();
      expect(isReturningFromStream()).toBe(true);

      clearReturningFromStream();

      expect(isReturningFromStream()).toBe(false);
      expect(sessionStorage.getItem(FROM_STREAM_KEY)).toBeNull();
    });
  });

  describe("server-side calls", () => {
    beforeEach(() => {
      vi.stubGlobal("window", undefined);
      vi.stubGlobal("sessionStorage", undefined);
    });

    it("do nothing and do not throw when window and sessionStorage are absent", () => {
      expect(() => saveDashboardScroll("?a=1")).not.toThrow();
      expect(() => markNavigatingToStream()).not.toThrow();
      expect(() => clearReturningFromStream()).not.toThrow();
      expect(getSavedDashboardScroll("?a=1")).toBeNull();
      expect(isReturningFromStream()).toBe(false);
    });
  });
});
