import Link from "next/link";
import type { StreamView } from "@/types/stream";
import { StreamCard } from "@/components/stream-card";
import { StreamTable } from "@/components/stream-table";

// Switch to the table layout once a section has this many streams.
// Fewer items are easier to scan as cards; a table is better for large lists.
const TABLE_THRESHOLD = 5;

interface Props {
  streams: StreamView[];
  emptyMessage?: string;
  /** Show a "Create a stream" call-to-action when the list is empty. */
  showCreateLink?: boolean;
}

export function StreamList({
  streams,
  emptyMessage = "No streams yet.",
  showCreateLink = false,
}: Props) {
  if (streams.length === 0) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
        {showCreateLink && (
          <Link
            href="/create"
            className="inline-flex items-center gap-1 self-start rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200"
          >
            {/* + icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              className="h-3 w-3"
            >
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
            Create a stream
          </Link>
        )}
      </div>
    );
  }

  if (streams.length >= TABLE_THRESHOLD) {
    return <StreamTable streams={streams} />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {streams.map((stream) => (
        <StreamCard key={stream.id} stream={stream} />
      ))}
    </div>
  );
}
