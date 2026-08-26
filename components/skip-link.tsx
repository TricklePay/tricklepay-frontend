export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="
        sr-only
        focus:not-sr-only
        focus:absolute
        focus:left-4
        focus:top-4
        focus:z-50
        focus:rounded
        focus:bg-neutral-900
        focus:px-4
        focus:py-2
        focus:text-sm
        focus:font-medium
        focus:text-neutral-100
        focus:outline
        focus:outline-2
        focus:outline-offset-2
        focus:outline-neutral-400
      "
    >
      Skip to main content
    </a>
  );
}
