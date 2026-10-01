"use client";

import { useLayoutEffect, useRef, useState } from "react";

export const MINIMUM_LOADING_DURATION_MS = 300;

export function useMinimumLoadingDuration(isLoading: boolean): boolean {
  const [isRetained, setIsRetained] = useState(false);
  const startedAt = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (isLoading) {
      if (startedAt.current === null) startedAt.current = Date.now();
      return;
    }

    if (startedAt.current === null) return;

    const remaining = MINIMUM_LOADING_DURATION_MS - (Date.now() - startedAt.current);
    if (remaining <= 0) {
      startedAt.current = null;
      setIsRetained(false);
      return;
    }

    setIsRetained(true);
    const timer = setTimeout(() => {
      startedAt.current = null;
      setIsRetained(false);
    }, remaining);

    return () => clearTimeout(timer);
  }, [isLoading]);

  return isLoading || isRetained;
}