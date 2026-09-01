const DOT_SIZE = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
};

/**
 * Three bouncing indigo dots — echoing the trickle-drop mark in app/icon.svg
 * and the app's own metaphor (value trickling in over time) instead of a
 * generic spinner. Announces itself to screen readers via role="status";
 * the dots are purely decorative. Bounce timing is collapsed to a single
 * frame under prefers-reduced-motion by the global rule in app/globals.css.
 * 
 * @param label - Screen reader text for the loading state. Defaults to "Loading".
 * @param size - Size variant for the dots: "sm" | "md" | "lg". Defaults to "md".
 */

interface BrandSpinnerProps {
  label?: string;
  size?: keyof typeof DOT_SIZE;
}

export function BrandSpinner({
  label = "Loading",
  size = "md",
}: BrandSpinnerProps
) {
  const dot = DOT_SIZE[size];

  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span className="flex items-end gap-1" aria-hidden="true">
        <span className={`${dot} animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]`} />
        <span className={`${dot} animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]`} />
        <span className={`${dot} animate-bounce rounded-full bg-indigo-500`} />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
