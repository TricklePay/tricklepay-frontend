import { afterEach, describe, expect, it } from "vitest";
import {
  formatUtc,
  formatUtcFromLocalInput,
  formatUtcFromUnixSeconds,
  resolvedTimeZoneLabel,
  resolvedTimeZoneName,
  utcOffsetLabel,
} from "@/lib/timezone";

// Node reads process.env.TZ freshly on each Date/Intl call rather than
// caching it at startup, so tests can pin a zone per-case and restore the
// original value afterwards.
const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("resolvedTimeZoneName", () => {
  it("resolves the zone Node/the browser is actually running in", () => {
    process.env.TZ = "America/New_York";
    expect(resolvedTimeZoneName()).toBe("America/New_York");
  });
});

describe("utcOffsetLabel", () => {
  it("formats a negative (west of UTC) offset", () => {
    process.env.TZ = "America/New_York";
    // 2026-01-15 is outside DST (EST, UTC-05:00).
    expect(utcOffsetLabel(new Date("2026-01-15T12:00:00Z"))).toBe("UTC-05:00");
  });

  it("reflects a DST change for the same named zone", () => {
    process.env.TZ = "America/New_York";
    // 2026-07-15 is inside DST (EDT, UTC-04:00) — same IANA zone as above,
    // different offset, which is exactly why the offset is computed per
    // instant rather than once.
    expect(utcOffsetLabel(new Date("2026-07-15T12:00:00Z"))).toBe("UTC-04:00");
  });

  it("formats a positive (east of UTC) offset", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(utcOffsetLabel(new Date("2026-01-15T12:00:00Z"))).toBe("UTC+09:00");
  });

  it("formats UTC itself with an explicit sign", () => {
    process.env.TZ = "UTC";
    expect(utcOffsetLabel(new Date("2026-01-15T12:00:00Z"))).toBe("UTC+00:00");
  });
});

describe("resolvedTimeZoneLabel", () => {
  it("combines the zone name and its offset at the given instant", () => {
    process.env.TZ = "America/New_York";
    expect(resolvedTimeZoneLabel(new Date("2026-01-15T12:00:00Z"))).toBe(
      "America/New_York (UTC-05:00)",
    );
  });
});

describe("formatUtc", () => {
  it("renders an instant's UTC date and time regardless of local zone", () => {
    process.env.TZ = "America/New_York";
    expect(formatUtc(new Date("2026-08-27T18:30:00Z"))).toBe("2026-08-27 18:30 UTC");
  });

  it("agrees across different local zones for the same instant", () => {
    const instant = new Date("2026-08-27T18:30:00Z");
    process.env.TZ = "Asia/Tokyo";
    const fromTokyo = formatUtc(instant);
    process.env.TZ = "America/Los_Angeles";
    const fromLA = formatUtc(instant);
    expect(fromTokyo).toBe(fromLA);
    expect(fromTokyo).toBe("2026-08-27 18:30 UTC");
  });
});

describe("formatUtcFromLocalInput", () => {
  it("interprets a datetime-local value as local time, matching toUnix", () => {
    process.env.TZ = "America/New_York";
    // Noon EDT (UTC-04:00) on 2026-08-27 is 16:00 UTC.
    expect(formatUtcFromLocalInput("2026-08-27T12:00")).toBe("2026-08-27 16:00 UTC");
  });

  it("returns null for an empty value", () => {
    expect(formatUtcFromLocalInput("")).toBeNull();
  });

  it("returns null for an unparseable value", () => {
    expect(formatUtcFromLocalInput("not-a-date")).toBeNull();
  });
});

describe("formatUtcFromUnixSeconds", () => {
  it("matches formatUtc for the same instant", () => {
    process.env.TZ = "America/New_York";
    expect(formatUtcFromUnixSeconds("1798821000")).toBe(formatUtc(new Date(1798821000 * 1000)));
  });
});
