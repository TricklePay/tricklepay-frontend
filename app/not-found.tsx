import Link from "next/link";


// Next's file-based 404: renders for any URL that matches no route, or
// wherever a Server Component calls `notFound()`. Distinct from the
// stream-specific "not found" branch in app/streams/[id]/page.tsx, which
// handles a missing stream id within an otherwise-valid route and needs its
// own retry/back affordances rather than this generic one.
export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="font-mono text-sm text-neutral-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-neutral-400">
        The page you&rsquo;re looking for doesn&rsquo;t exist, or the link might be
        incorrect.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
      >
        Go to your streams
      </Link>
    </main>
  );
}
