import Link from "next/link";
import type { JSX } from "react";

import { AddressWithLabel } from "@/components/address-label";
import { StreamStatusBadge } from "@/components/stream-status-badge";
import { useTokenDecimals } from "@/hooks/use-token-decimals";
import { useTokenMetadata } from "@/hooks/use-token-metadata";
import { formatTokenAmount } from "@/lib/format";
import { formatRemaining, formatSchedule } from "@/lib/schedule";
import { markNavigatingToStream } from "@/lib/scroll";
import type { StreamView } from "@/types/stream";

export function StreamCard({ stream }: { stream: StreamView }): JSX.Element {
  useTokenDecimals([stream.token]);
  useTokenMetadata(stream.token);
  const remaining = formatRemaining(stream);
  // Only a cliff strictly after the start is worth a row; one at or before it
  // changes nothing about when withdrawals begin.
  const cliff =
    BigInt(stream.cliffTime) > BigInt(stream.startTime) ? formatSchedule(stream).cliff : null;

  return (
    <Link
      href={`/streams/${stream.id}`}
      onClick={() => {
        if (typeof window !== "undefined") {
          markNavigatingToStream(window.location.search);
        }
      }}
      className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-sm text-neutral-300">#{stream.id}</span>
        <StreamStatusBadge status={stream.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-neutral-500">From</p>
          <p className="font-mono text-neutral-300"><AddressWithLabel address={stream.sender} /></p>
        </div>
        <div>
          <p className="text-neutral-500">To</p>
          <p className="font-mono text-neutral-300"><AddressWithLabel address={stream.recipient} /></p>
        </div>
        <div>
          <p className="text-neutral-500">Withdrawable</p>
          <p className="text-neutral-100" title={stream.token}>
            {formatTokenAmount(stream.withdrawable, stream.token)}
          </p>
        </div>
        <div>
          <p className="text-neutral-500">Total</p>
          <p className="text-neutral-100" title={stream.token}>
            {formatTokenAmount(stream.totalAmount, stream.token)}
          </p>
        </div>
        {cliff && (
          <div className="col-span-2" data-testid="stream-card-cliff">
            <p className="text-neutral-500">Cliff</p>
            <p className="text-neutral-100">
              {cliff.local}{" "}
              <span className="text-neutral-500">({cliff.countdown})</span>
            </p>
          </div>
        )}
      </div>
      {remaining && <p className="mt-3 text-xs text-neutral-500">{remaining}</p>}
    </Link>
  );
}
