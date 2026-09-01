import Link from "next/link";
import type { StreamStatus, StreamView } from "@/types/stream";
import { formatAmount, timeRemaining, truncateAddress } from "@/lib/format";

const STATUS_STYLES: Record<StreamStatus, string> = {
  pending: "border border-neutral-700 bg-neutral-800 text-neutral-300",
  streaming: "border border-green-700/50 bg-green-950/40 text-green-300",
  completed: "border border-blue-700/50 bg-blue-950/40 text-blue-300",
  cancelled: "border border-red-700/50 bg-red-950/40 text-red-300",
};

const STATUS_ICONS: Record<StreamStatus, string> = {
  pending: "⏳",
  streaming: "●",
  completed: "✓",
  cancelled: "✕",
};

interface StreamCardProps {
  stream: StreamView;
}

export function StreamCard({ stream }: StreamCardProps) {
  return (
    <Link
      href={`/streams/${stream.id}`}
      className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-sm text-neutral-300">#{stream.id}</span>
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[stream.status]}`}
        >
          <span aria-hidden="true" className="text-[10px]">
            {STATUS_ICONS[stream.status]}
          </span>
          <span>{stream.status}</span>
        </span>
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
