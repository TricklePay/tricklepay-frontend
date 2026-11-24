// Builds a CSV export of a list of streams (the dashboard's "Export CSV"
// button — see app/page.tsx). Kept free of the DOM so it can be unit tested
// headlessly; lib/csv-download.ts turns the string this produces into an
// actual file download.
//
// Amounts go through formatAmount (BigInt-based, see lib/format.ts), never
// Number()/parseFloat, so a balance beyond Number.MAX_SAFE_INTEGER is never
// silently truncated into a float. Times go through the same exact-UTC
// formatter used everywhere else in the app (lib/timezone.ts's
// formatUtcFromUnixSeconds) rather than a locale-dependent Date string, so a
// row opened in any spreadsheet, in any timezone, reads the same instant.

import { formatAmount } from "@/lib/format";
import { formatUtcFromUnixSeconds } from "@/lib/timezone";
import { getCachedTokenDecimals } from "@/lib/token-decimals";
import type { StreamEvent, StreamView } from "@/types/stream";

const CSV_COLUMNS = [
  "Stream ID",
  "Status",
  "Sender",
  "Recipient",
  "Token",
  "Total Amount",
  "Vested",
  "Withdrawn",
  "Withdrawable",
  "Locked",
  "Start Time (UTC)",
  "End Time (UTC)",
  "Cliff Time (UTC)",
] as const;

/**
 * Escapes one CSV field per RFC 4180: a value containing a comma, a double
 * quote, or a line break (`\n` or `\r`) is wrapped in double quotes, with
 * every double quote inside it doubled first. A value with none of those is
 * returned unchanged, so most fields in practice (ids, addresses, amounts)
 * pass straight through.
 *
 * @example
 * escapeCsvField("GABC...") // → "GABC..." (unchanged)
 * escapeCsvField("1,000")   // → "\"1,000\""
 * escapeCsvField('5" pipe') // → "\"5\"\" pipe\""
 */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function streamRow(stream: StreamView): string[] {
  // falls back to 7 until the token's decimals have been read
  const decimals = getCachedTokenDecimals(stream.token) ?? 7;
  return [
    stream.id,
    stream.status,
    stream.sender,
    stream.recipient,
    stream.token,
    formatAmount(stream.totalAmount, decimals),
    formatAmount(stream.vested, decimals),
    formatAmount(stream.withdrawn, decimals),
    formatAmount(stream.withdrawable, decimals),
    formatAmount(stream.locked, decimals),
    formatUtcFromUnixSeconds(stream.startTime),
    formatUtcFromUnixSeconds(stream.endTime),
    formatUtcFromUnixSeconds(stream.cliffTime),
  ];
}

/**
 * Builds a complete CSV document for the given streams: a header row, then
 * one row per stream in the order given — the caller decides that order
 * (e.g. whichever streams are currently visible, already filtered). Lines
 * are joined with CRLF per RFC 4180, including a trailing CRLF after the
 * last row.
 */
export function streamsToCsv(streams: StreamView[]): string {
  const rows = [[...CSV_COLUMNS], ...streams.map(streamRow)];
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
}

const EVENT_CSV_COLUMNS = [
  "Event ID",
  "Kind",
  "Stream ID",
  "Ledger",
  "Time (UTC)",
  "Transaction Hash",
  "Token",
  "Amount",
  "Recipient Amount",
  "Sender Refund",
] as const;

function eventRow(event: StreamEvent, streamToken: string, decimals: number): string[] {
  const exact = (raw?: string | null) => (raw != null ? formatAmount(raw, decimals) : "");
  return [
    event.eventId,
    event.kind,
    event.streamId,
    String(event.ledger),
    event.closedAt != null ? formatUtcFromUnixSeconds(event.closedAt) : "",
    event.txHash,
    event.token ?? streamToken,
    // A created event carries totalAmount, a withdrawn event carries amount.
    exact(event.totalAmount ?? event.amount),
    exact(event.recipientAmount),
    exact(event.senderRefund),
  ];
}

/**
 * Builds a CSV document for a stream's event history, in the order given. Amounts
 * go through formatAmount with the token's decimals (BigInt math, never a float).
 * Same RFC 4180 escaping and CRLF line endings as streamsToCsv.
 */
export function eventsToCsv(
  events: StreamEvent[],
  streamToken: string,
  decimals: number = 7,
): string {
  const rows = [[...EVENT_CSV_COLUMNS], ...events.map((e) => eventRow(e, streamToken, decimals))];
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
}
