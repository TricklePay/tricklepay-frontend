import type { StreamStatus } from "@/types/stream";

export const STREAM_STATUS_META: Record<
  StreamStatus,
  { dot: string; style: string; icon: string; label: string; description: string }
> = {
  pending: {
    dot: "bg-neutral-400",
    style: "border border-neutral-700 bg-neutral-800 text-neutral-300",
    icon: "⏳",
    label: "Pending",
    description: "Start time not yet reached",
  },
  streaming: {
    dot: "bg-green-400",
    style: "border border-green-700/50 bg-green-950/40 text-green-300",
    icon: "●",
    label: "Streaming",
    description: "Tokens are actively vesting",
  },
  completed: {
    dot: "bg-blue-400",
    style: "border border-blue-700/50 bg-blue-950/40 text-blue-300",
    icon: "✓",
    label: "Completed",
    description: "Fully vested and ended",
  },
  cancelled: {
    dot: "bg-red-400",
    style: "border border-red-700/50 bg-red-950/40 text-red-300",
    icon: "✕",
    label: "Cancelled",
    description: "Stopped before end time",
  },
};
