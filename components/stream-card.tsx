import Link from "next/link";
import type { StreamStatus, StreamView } from "@/types/stream";
import { formatAmount, timeRemaining, truncateAddress } from "@/lib/format";

const STATUS_STYLES: Record<StreamStatus, string> = {
  pending: "bg-neutral-800 text-neutral-300",
  streaming: "bg-green-900/40 text-green-300",
  completed: "bg-blue-900/40 text-blue-300",
  cancelled: "bg-red-900/40 text-red-300",
};

export function StreamCard({ stream }: { stream: StreamView }) {
  return (
    <Link
      href={`/streams/${stream.id}`}
      className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4 hover:border-neutral-600"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-sm text-neutral-300">#{stream.id}</span>
        <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[stream.status]}`}>
          {stream.status}
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
