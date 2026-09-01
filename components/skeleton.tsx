// Skeleton shimmer primitives and composed page-level skeletons.
// Every skeleton is sized to match its real counterpart so that no layout shift
// occurs when data arrives. Dimensions are taken directly from the components
// they stand in for.

// ---------------------------------------------------------------------------
// Base primitive
// ---------------------------------------------------------------------------

/**
 * A single shimmering block. Use `className` to set width, height, and any
 * extra spacing. The pulse animation is applied here so every derived skeleton
 * inherits it without repetition.
 * 
 * @param className - Optional CSS classes to control size and spacing. Defaults to empty string.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-neutral-800 ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// StreamCard skeleton
// Mirrors StreamCard in components/stream-card.tsx:
//   - header row: id chip + status badge
//   - 2×2 grid: From / To / Withdrawable / Total
//   - time-remaining line at the bottom
// ---------------------------------------------------------------------------
export function StreamCardSkeleton() {
  return (
    <div
      aria-label="Loading stream"
      className="block rounded-lg border border-neutral-800 bg-neutral-950 p-4"
    >
      {/* Header: mono id + status badge */}
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>

      {/* 2×2 data grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* From */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-4 w-24" />
        </div>
        {/* To */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-4 w-24" />
        </div>
        {/* Withdrawable */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-14" />
        </div>
        {/* Total */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>

      {/* Time-remaining line */}
      <Skeleton className="mt-3 h-3 w-24" />
    </div>
  );
}

/**
 * A grid of N card skeletons matching StreamList's grid layout.
 * 
 * @param count - Number of skeleton cards to render. Defaults to 4.
 */
export function StreamListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <StreamCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StreamDetail skeleton
// Mirrors StreamDetailPage / StreamDetail in components/stream-detail.tsx:
//   - back link
//   - heading row (Stream #id + status badge)
//   - large withdrawal box (label, amount, sub-line, progress bar)
//   - 7-field dl grid (From, To, Token, Withdrawn, Start, End, Cliff)
//   - actions area (one or two buttons)
// ---------------------------------------------------------------------------
export function StreamDetailSkeleton() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10" aria-label="Loading stream details">
      {/* Back link */}
      <Skeleton className="h-3 w-10" />

      {/* Heading row */}
      <div className="mb-6 mt-3 flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>

      {/* Withdrawal box */}
      <div className="mb-8 rounded-lg border border-neutral-800 p-6">
        <Skeleton className="h-3 w-28" />
        {/* Large amount figure */}
        <Skeleton className="mt-1 h-10 w-48" />
        {/* Sub-line */}
        <Skeleton className="mt-1 h-3 w-64" />
        {/* Progress bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
          <Skeleton className="h-full w-1/3 rounded-full" />
        </div>
      </div>

      {/* Field grid — 7 fields in a 2-column layout */}
      <dl className="grid grid-cols-2 gap-4 text-sm">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </dl>

      {/* Actions area */}
      <div className="mt-8 flex gap-3">
        <Skeleton className="h-9 w-24 rounded" />
        <Skeleton className="h-9 w-28 rounded" />
      </div>
    </main>
  );
}
