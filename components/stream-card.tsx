import Link from "next/link";
import type { JSX } from "react";

import { StreamStatusBadge } from "@/components/stream-status-badge";
import { formatAmount, timeRemaining, truncateAddress } from "@/lib/format";
import type { StreamView } from "@/types/stream";

export function StreamCard({ stream }: { stream: StreamView }): JSX.Element {
  return (
    <Link
      href={`/streams/${stream.id}`}
      className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-sm text-neutral-300">#{stream.id}</span>
        <StreamStatusBadge status={stream.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-neutral-500">From</p>
          <p className="font-mono text-neutral-300">{truncateAddress(stream.sender)}</p>
        </div>
        <div>
          <p className="text-neutral-500">To</p>
          <p className="font-mono text-neutral-300">{truncateAddress(stream.recipient)}</p>
        </div>
        <div>
          <p className="text-neutral-500">Withdrawable</p>
          <p className="text-neutral-100">{formatAmount(stream.withdrawable)}</p>
        </div>
        <div>
          <p className="text-neutral-500">Total</p>
          <p className="text-neutral-100">{formatAmount(stream.totalAmount)}</p>
        </div>
      </div>
      {(stream.status === "streaming" || stream.status === "pending") && (
        <p className="mt-3 text-xs text-neutral-500">{timeRemaining(stream.endTime)}</p>
      )}
    </Link>
  );
}
