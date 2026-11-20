"use client";

import { useEffect, useState } from "react";

import { getCachedTokenDecimals, readTokenDecimals } from "@/lib/token-decimals";
import { isValidContractAddress } from "@/lib/validation";

/** Resolve uncached decimals and re-render the amount displays as each token settles. */
export function useTokenDecimals(tokens: readonly string[]): void {
  const [, setRevision] = useState(0);
  const tokenKey = Array.from(new Set(tokens.map((token) => token.trim()))).sort().join(",");

  useEffect(() => {
    let active = true;

    for (const token of tokenKey.split(",")) {
      if (!isValidContractAddress(token) || getCachedTokenDecimals(token) !== null) continue;
      void readTokenDecimals(token).then(
        () => {
          if (active) setRevision((revision) => revision + 1);
        },
        () => {
          // Keep the display fallback when RPC cannot resolve the token.
        },
      );
    }

    return () => { active = false; };
  }, [tokenKey]);
}
