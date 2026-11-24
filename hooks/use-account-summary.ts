"use client";

import { useEffect, useState } from "react";

import { getAccountSummary, isAbortError } from "@/lib/api";
import type { AccountSummary } from "@/types/stream";

/**
 * Loads the backend's account-wide totals (`GET /accounts/:address/summary`).
 * Returns null until loaded, or when the request fails: the figures are
 * advisory, so the dashboard just leaves them out instead of showing an error.
 */
export function useAccountSummary(address: string | null): AccountSummary | null {
  const [summary, setSummary] = useState<AccountSummary | null>(null);

  useEffect(() => {
    setSummary(null);
    if (!address) return;
    const controller = new AbortController();
    let cancelled = false;

    getAccountSummary(address, { signal: controller.signal })
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((err: unknown) => {
        if (cancelled || isAbortError(err)) return;
        setSummary(null);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [address]);

  return summary;
}
