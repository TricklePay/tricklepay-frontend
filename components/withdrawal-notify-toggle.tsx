"use client";

import { type JSX, useEffect, useRef, useState } from "react";

import { formatTokenAmount } from "@/lib/format";
import { getCachedTokenDecimals, DEFAULT_TOKEN_DECIMALS } from "@/lib/token-decimals";
import {
  crossedThreshold,
  readNotifyOptIn,
  withdrawNotifyThreshold,
  writeNotifyOptIn,
} from "@/lib/withdrawal-notify";
import type { StreamView } from "@/types/stream";

export interface WithdrawalNotifyToggleProps {
  stream: StreamView;
  /** Live withdrawable amount in base units (from useAccrual). */
  withdrawable: bigint;
}

/**
 * Opt-in checkbox for a browser notification when the recipient's withdrawable
 * amount crosses the threshold. The permission prompt is only raised from the
 * checkbox click, never on page load.
 */
export function WithdrawalNotifyToggle({
  stream,
  withdrawable,
}: WithdrawalNotifyToggleProps): JSX.Element | null {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const wasAbove = useRef<boolean | null>(null);

  // Read browser-only state after mount so server and first client render agree.
  useEffect(() => {
    setSupported(typeof Notification !== "undefined");
    setEnabled(
      typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        readNotifyOptIn(stream.id),
    );
  }, [stream.id]);

  const decimals = getCachedTokenDecimals(stream.token) ?? DEFAULT_TOKEN_DECIMALS;
  const threshold = withdrawNotifyThreshold(BigInt(stream.totalAmount), decimals);

  useEffect(() => {
    if (!enabled) {
      wasAbove.current = null;
      return;
    }
    const { above, fire } = crossedThreshold(wasAbove.current, withdrawable, threshold);
    wasAbove.current = above;
    if (fire && Notification.permission === "granted") {
      new Notification(`Stream #${stream.id}: withdrawal available`, {
        body: `${formatTokenAmount(withdrawable.toString(), stream.token)} can be withdrawn.`,
        tag: `tricklepay-withdraw-${stream.id}`,
      });
    }
  }, [enabled, withdrawable, threshold, stream.id, stream.token]);

  if (!supported) return null;

  async function onChange(checked: boolean) {
    if (!checked) {
      writeNotifyOptIn(stream.id, false);
      setEnabled(false);
      return;
    }
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    setBlocked(permission !== "granted");
    if (permission === "granted") {
      writeNotifyOptIn(stream.id, true);
      setEnabled(true);
    }
  }

  return (
    <div className="mt-3 text-xs text-neutral-400">
      <label className="inline-flex min-h-[44px] items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => void onChange(e.target.checked)}
        />
        Notify me when a withdrawal is available
      </label>
      <p className="text-neutral-500">
        Works while this tab is open. Nothing is sent to a server.
      </p>
      {blocked && (
        <p role="alert" className="text-amber-400/80">
          Notifications are blocked in your browser settings.
        </p>
      )}
    </div>
  );
}
