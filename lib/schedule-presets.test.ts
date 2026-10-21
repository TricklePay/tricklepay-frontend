import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applySchedulePreset, SCHEDULE_PRESETS } from "./schedule-presets";

describe("SCHEDULE_PRESETS", () => {
  it("defines the three standard presets", () => {
    const ids = SCHEDULE_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      "one-month-linear",
      "one-year-three-month-cliff",
      "four-years-one-year-cliff",
    ]);
  });
});

describe("applySchedulePreset", () => {
  const BASE_START = "2026-08-27T10:00";

  it("applies the 1 month, linear preset without a cliff", () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === "one-month-linear")!;
    const schedule = applySchedulePreset(preset, BASE_START);

    expect(schedule).toEqual({
      start: BASE_START,
      end: "2026-09-27T10:00",
      cliff: null,
    });
  });

  it("applies the 1 year, 3-month cliff preset", () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === "one-year-three-month-cliff")!;
    const schedule = applySchedulePreset(preset, BASE_START);

    expect(schedule).toEqual({
      start: BASE_START,
      end: "2027-08-27T10:00",
      cliff: "2026-11-27T10:00",
    });
  });

  it("applies the 4 years, 1-year cliff preset", () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === "four-years-one-year-cliff")!;
    const schedule = applySchedulePreset(preset, BASE_START);

    expect(schedule).toEqual({
      start: BASE_START,
      end: "2030-08-27T10:00",
      cliff: "2027-08-27T10:00",
    });
  });

  it("defaults to the provided 'now' instant when currentStart is empty", () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === "one-month-linear")!;
    const now = new Date("2026-01-15T12:00:00");
    const schedule = applySchedulePreset(preset, "", now);

    expect(schedule).not.toBeNull();
    expect(schedule?.start).toBe("2026-01-15T12:00");
    expect(schedule?.end).toBe("2026-02-15T12:00");
    expect(schedule?.cliff).toBeNull();
  });

  it("returns null if the start date fails to parse", () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === "one-month-linear")!;
    expect(applySchedulePreset(preset, "invalid-date")).toBeNull();
  });
});


// Expected start/end/cliff per preset with the clock pinned. Keyed by id so a
// new preset without an entry here fails the coverage test below (#464).
const EXPECTED_FROM_NOW: Record<string, { end: string; cliff: string | null }> = {
  "one-month-linear": { end: "2026-02-15T12:00", cliff: null },
  "one-year-three-month-cliff": { end: "2027-01-15T12:00", cliff: "2026-04-15T12:00" },
  "four-years-one-year-cliff": { end: "2030-01-15T12:00", cliff: "2027-01-15T12:00" },
};

describe("applySchedulePreset with a controlled clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED_FROM_NOW).sort()).toEqual(
      SCHEDULE_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(SCHEDULE_PRESETS.map((p) => [p.id, p] as const))(
    "%s starts now and sets the intended end and cliff",
    (id, preset) => {
      // No explicit `now`: the default must come from the (faked) clock.
      const schedule = applySchedulePreset(preset, "");
      expect(schedule).toEqual({ start: "2026-01-15T12:00", ...EXPECTED_FROM_NOW[id] });
    },
  );

  it("keeps an entered start instead of using the clock", () => {
    const preset = SCHEDULE_PRESETS[0];
    expect(applySchedulePreset(preset, "2026-03-31T09:30")?.start).toBe("2026-03-31T09:30");
  });
});
