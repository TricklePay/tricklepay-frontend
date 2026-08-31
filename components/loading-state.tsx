import { BrandSpinner } from "@/components/brand-spinner";
import { StreamDetailSkeleton, StreamListSkeleton } from "@/components/skeleton";

type LoadingVariant = "list" | "detail" | "generic";

interface LoadingStateProps {
  /** Which loading placeholder to render. */
  variant: LoadingVariant;
  /** Number of skeleton cards for the list variant. */
  listCount?: number;
  /** Accessible label for the generic spinner variant. */
  label?: string;
  /** Spinner size for the generic variant. */
  spinnerSize?: "sm" | "md" | "lg";
  /** Optional extra classes for the generic variant wrapper. */
  className?: string;
}

/**
 * Centralized loading placeholder.
 *
 * Keeps the various loading states consistent across views and avoids
 * repeating skeleton markup inline. Page-level skeletons (list/detail) are
 * sized to match their real counterparts so layout shift is avoided.
 */
export function LoadingState({
  variant,
  listCount = 4,
  label = "Loading",
  spinnerSize = "md",
  className = "",
}: LoadingStateProps) {
  if (variant === "list") {
    return <StreamListSkeleton count={listCount} />;
  }

  if (variant === "detail") {
    return <StreamDetailSkeleton />;
  }

  return (
    <main className={`flex min-h-[50vh] items-center justify-center ${className}`}>
      <BrandSpinner label={label} size={spinnerSize} />
    </main>
  );
}
