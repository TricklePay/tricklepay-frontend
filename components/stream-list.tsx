import type { StreamView } from "@/types/stream";
import { StreamCard } from "@/components/stream-card";

interface Props {
  streams: StreamView[];
  emptyMessage?: string;
}

export function StreamList({ streams, emptyMessage = "No streams yet." }: Props) {
  if (streams.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {streams.map((stream) => (
        <StreamCard key={stream.id} stream={stream} />
      ))}
    </div>
  );
}
