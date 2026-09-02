"use client";

import { useEffect } from "react";


// Next's file-based error boundary: catches any render-time throw in a page
// or layout beneath this segment that isn't already handled by that page's
// own try/catch (e.g. app/streams/[id]/page.tsx catches its own fetch errors
// and renders an inline retry state — this only catches what gets past that).
// Must be a Client Component; Next requires it to render an error boundary.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No error-reporting service is wired up yet; the console is the only
    // record of what actually crashed, so log it rather than only showing
    // the generic UI below.
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="font-mono text-sm text-red-400">Error</p>
      <h1 className="mt-2 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-neutral-400">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Try again
        </button>
        {/* A plain anchor rather than next/link: if the crash left client
            state corrupted, this forces a full reload instead of a
            client-side transition that could carry the broken state along. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
        >
          Go to your streams
        </a>
      </div>
    </main>
  );
}
