// Timezone disclosure for the create-stream form, its review step, and the
// stream detail page. `datetime-local` inputs are parsed as local time
// (toUnix in create-form.tsx) and formatTime() in lib/format.ts renders back
// to local — correctly, but silently. Nothing in the UI otherwise says which
// zone "local" means, so someone scheduling a stream across timezones has no
// way to confirm the interpretation without doing the arithmetic themselves.
// These helpers make the resolved zone explicit and echo the UTC equivalent
// alongside it.

import { MS_PER_SECOND, SECONDS_PER_MINUTE } from "@/lib/constants";


const UTC_DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
};

// The IANA name of the timezone `datetime-local` inputs and formatTime()
// resolve against, e.g. "America/New_York". Falls back to "UTC" on a runtime
// that can't resolve one at all, rather than throwing.
export function resolvedTimeZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// The UTC offset in effect for a specific instant, as "UTC+01:00" /
// "UTC-05:00" / "UTC+00:00". Takes the instant rather than assuming "now"
// because DST can put a stream's start and end at different offsets even
// though both resolve to the same named zone.
export function utcOffsetLabel(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / SECONDS_PER_MINUTE)).padStart(2, "0");
  const mm = String(abs % SECONDS_PER_MINUTE).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

// "America/New_York (UTC-04:00)" for a specific instant — the resolved zone
// name plus its numeric offset at that instant. The name alone doesn't say
// what it currently means in hours; the offset alone won't survive a DST
// change between visits.
export function resolvedTimeZoneLabel(date: Date = new Date()): string {
  return `${resolvedTimeZoneName()} (${utcOffsetLabel(date)})`;
}

// Formats an instant as its UTC equivalent, e.g. "2026-08-27 18:00 UTC".
export function formatUtc(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", UTC_DISPLAY_OPTIONS).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} UTC`;
}

// Parses a `datetime-local` input value the same way toUnix does (as local
// time) and returns its UTC equivalent, or null for an empty/invalid value
// so callers can hide the echo instead of showing "Invalid Date UTC".
export function formatUtcFromLocalInput(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return formatUtc(date);
}

// Formats a Unix-second timestamp string's UTC equivalent, matching
// formatTime's input contract — for the stream detail page and the
// create-stream review step, which both already have resolved instants
// rather than a raw `datetime-local` string.
export function formatUtcFromUnixSeconds(unixSeconds: string): string {
  return formatUtc(new Date(Number(unixSeconds) * MS_PER_SECOND));
}
