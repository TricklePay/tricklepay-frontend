// Builds an iCalendar (RFC 5545) file with the cliff and end of a stream, so a
// recipient can set a reminder in their own calendar. Kept free of the DOM so
// it can be unit tested headlessly; downloadIcs below is the only DOM glue.
//
// Every time is written in UTC ("Z" form), so the reminder lands on the same
// instant in any calendar app regardless of the viewer's timezone.

import { formatTokenDisplay } from "@/lib/format";
import type { StreamView } from "@/types/stream";

// RFC 5545 section 3.1: lines longer than 75 octets are folded with CRLF + space.
const MAX_LINE_LENGTH = 75;

function icsUtc(unixSeconds: string): string {
  return new Date(Number(unixSeconds) * 1000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= MAX_LINE_LENGTH) return line;
  const parts = [line.slice(0, MAX_LINE_LENGTH)];
  for (let i = MAX_LINE_LENGTH; i < line.length; i += MAX_LINE_LENGTH - 1) {
    parts.push(line.slice(i, i + MAX_LINE_LENGTH - 1));
  }
  return parts.join("\r\n ");
}

function event(stream: StreamView, kind: "cliff" | "end", unixSeconds: string, stamp: string): string[] {
  const label = kind === "cliff" ? "cliff unlocks" : "stream ends";
  return [
    "BEGIN:VEVENT",
    `UID:tricklepay-stream-${stream.id}-${kind}@tricklepay`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsUtc(unixSeconds)}`,
    `SUMMARY:${escapeText(`Stream #${stream.id} (${formatTokenDisplay(stream.token)}): ${label}`)}`,
    "END:VEVENT",
  ];
}

/**
 * Builds the calendar document for a stream: one event for the cliff (when the
 * stream has one) and one for the end. Event titles carry the stream id and the
 * token. Lines are joined with CRLF, including a trailing CRLF.
 */
export function streamToIcs(stream: StreamView, now: Date = new Date()): string {
  const stamp = icsUtc(String(Math.floor(now.getTime() / 1000)));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TricklePay//Stream//EN",
    "CALSCALE:GREGORIAN",
  ];
  if (stream.cliffTime !== stream.startTime) {
    lines.push(...event(stream, "cliff", stream.cliffTime, stamp));
  }
  lines.push(...event(stream, "end", stream.endTime, stamp));
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
