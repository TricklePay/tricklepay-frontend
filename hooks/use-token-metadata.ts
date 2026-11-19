"use client";

import { useEffect, useState } from "react";

import {
  type TokenMetadata,
  KNOWN_TOKEN_METADATA,
  getCachedTokenMetadata,
  readTokenMetadata,
  subscribeTokenMetadata,
} from "@/lib/token-metadata";
import { isValidContractAddress } from "@/lib/validation";

/**
 * React hook to get token metadata. Returns cached metadata or triggers simulation
 * for unknown tokens and updates reactively.
 */
export function useTokenMetadata(tokenAddress: string): TokenMetadata | null {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(() => {
    const candidate = tokenAddress.trim();
    return getCachedTokenMetadata(candidate) ?? KNOWN_TOKEN_METADATA[candidate] ?? null;
  });

  useEffect(() => {
    let cancelled = false;
    const candidate = tokenAddress.trim();
    if (!candidate || !isValidContractAddress(candidate)) {
      setMetadata(null);
      return;
    }

    const current = getCachedTokenMetadata(candidate) ?? KNOWN_TOKEN_METADATA[candidate] ?? null;
    if (current) {
      setMetadata(current);
      return;
    }

    readTokenMetadata(candidate)
      .then((meta) => {
        if (!cancelled) setMetadata(meta);
      })
      .catch(() => {
        if (!cancelled) {
          setMetadata(KNOWN_TOKEN_METADATA[candidate] ?? null);
        }
      });

    const unsubscribe = subscribeTokenMetadata(() => {
      if (!cancelled) {
        setMetadata(getCachedTokenMetadata(candidate) ?? KNOWN_TOKEN_METADATA[candidate] ?? null);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [tokenAddress]);

  return metadata;
}

/**
 * React hook to resolve metadata for a list of tokens in the background.
 */
export function useTokensMetadata(tokenAddresses: string[]): void {
  const [, setTick] = useState(0);
  const tokenKey = tokenAddresses.map((t) => t.trim()).join(",");

  useEffect(() => {
    let cancelled = false;
    const tokens = tokenKey.split(",").filter(Boolean);
    const unique = Array.from(new Set(tokens)).filter(
      (t) =>
        isValidContractAddress(t) &&
        !getCachedTokenMetadata(t) &&
        !KNOWN_TOKEN_METADATA[t],
    );

    for (const token of unique) {
      readTokenMetadata(token).catch(() => {});
    }

    const unsubscribe = subscribeTokenMetadata(() => {
      if (!cancelled) {
        setTick((t) => t + 1);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [tokenKey]);
}
