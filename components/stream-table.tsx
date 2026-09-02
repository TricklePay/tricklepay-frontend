import Link from "next/link";

import { formatAmount, timeRemaining, truncateAddress } from "@/lib/format";

import type { StreamStatus, StreamView } from "@/types/stream";


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

export function StreamTable({ streams }: { streams: StreamView[] }) {
  return (
    /* Horizontal scroll on narrow viewports so columns never get crushed */
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/60 text-left">
            <th
              scope="col"
              className="px-4 py-3 font-medium text-neutral-400"
            >
              #
            </th>
            <th
              scope="col"
              className="px-4 py-3 font-medium text-neutral-400"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-4 py-3 font-medium text-neutral-400"
            >
              From
            </th>
            <th
              scope="col"
              className="px-4 py-3 font-medium text-neutral-400"
            >
              To
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-medium text-neutral-400"
            >
              Withdrawable
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-medium text-neutral-400"
            >
              Total
            </th>
            <th
              scope="col"
              className="px-4 py-3 font-medium text-neutral-400"
            >
              Remaining
            </th>
          </tr>
        </thead>
        <tbody>
          {streams.map((stream, idx) => (
            <tr
              key={stream.id}
              className={`border-b border-neutral-800/60 transition-colors last:border-b-0 hover:bg-neutral-800/40 ${
                idx % 2 === 0 ? "" : "bg-neutral-900/30"
              }`}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/streams/${stream.id}`}
                  className="font-mono text-neutral-300 hover:text-neutral-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded"
                >
                  #{stream.id}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[stream.status]}`}
                >
                  <span aria-hidden="true" className="text-[10px]">
                    {STATUS_ICONS[stream.status]}
                  </span>
                  <span>{stream.status}</span>
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-neutral-300">
                {truncateAddress(stream.sender)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-neutral-300">
                {truncateAddress(stream.recipient)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-100">
                {formatAmount(stream.withdrawable)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                {formatAmount(stream.totalAmount)}
              </td>
              <td className="px-4 py-3 text-xs text-neutral-500">
                {stream.status === "streaming" || stream.status === "pending"
                  ? timeRemaining(stream.endTime)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
