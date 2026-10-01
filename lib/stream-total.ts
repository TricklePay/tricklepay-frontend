import { formatAmount, formatTokenAmount } from "@/lib/format";
import type { StreamView } from "@/types/stream";

export interface TokenTotal {
  token: string;
  total: bigint;
  formatted: string;
}

/**
 * Aggregates stream amounts grouped by token contract.
 *
 * Safely handles missing amounts or non-numeric values without throwing,
 * maintaining BigInt precision for 128-bit Soroban stream values.
 */
export function computeStreamTotals(streams: StreamView[]): TokenTotal[] {
  if (!Array.isArray(streams) || streams.length === 0) {
    return [];
  }

  const totalsByToken = new Map<string, bigint>();

  for (const stream of streams) {
    if (!stream || stream.totalAmount === undefined || stream.totalAmount === null) {
      continue;
    }

    try {
      const amount = BigInt(stream.totalAmount);
      if (amount <= 0n) continue;

      const token = stream.token ? stream.token.trim() : "";
      const current = totalsByToken.get(token) ?? 0n;
      totalsByToken.set(token, current + amount);
    } catch {
      // Ignore unparseable values gracefully
    }
  }

  if (totalsByToken.size === 0) {
    return [];
  }

  return Array.from(totalsByToken.entries()).map(([token, total]) => ({
    token,
    total,
    formatted: token
      ? formatTokenAmount(total.toString(), token)
      : formatAmount(total.toString()),
  }));
}

/**
 * Returns a human-readable total string across all given streams.
 *
 * For single-token lists, formats as "150 USDC" or "150".
 * For multi-token lists, formats as a comma-separated aggregate (e.g. "150 USDC, 50 XLM").
 * Returns "0" if the list is empty or has no positive totals.
 */
export function formatStreamsTotal(streams: StreamView[]): string {
  const totals = computeStreamTotals(streams);
  if (totals.length === 0) {
    return "0";
  }

  return totals.map((item) => item.formatted).join(", ");
}
