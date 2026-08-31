import { LoadingState } from "@/components/loading-state";

// Next.js renders this automatically while a route segment is loading (e.g.
// a slow initial chunk load), on top of whichever page-level skeleton (see
// components/skeleton.tsx) that route also renders once its own data starts
// fetching.
export default function Loading() {
  return <LoadingState variant="generic" label="Loading TricklePay" spinnerSize="lg" />;
}