import { STREAM_STATUS_META } from "@/lib/stream-status";
import type { StreamView } from "@/types/stream";

/** Suffix every page title carries; matches the template in app/layout.tsx. */
export const TITLE_SUFFIX = "TricklePay";

/**
 * Marker prepended while a status change the user has not looked at yet is
 * sitting in a background tab. Cleared as soon as the tab is visible again.
 */
export const UNSEEN_CHANGE_MARKER = "(!)";

/** Builds a page title using the app-wide "Page — TricklePay" pattern. */
export function pageDocumentTitle(page: string): string {
  return `${page} — ${TITLE_SUFFIX}`;
}

/**
 * Builds the document title for a stream's detail page, leading with the
 * status glyph and label so a background tab shows the stream's state at a
 * glance, e.g. "● Streaming · Stream #42 — TricklePay".
 *
 * The status comes first because browsers truncate long tab titles from the
 * end; the part that changes has to survive a narrow tab.
 */
export function streamDocumentTitle(
  stream: Pick<StreamView, "id" | "status">,
  unseenChange = false,
): string {
  const { icon, label } = STREAM_STATUS_META[stream.status];
  const title = pageDocumentTitle(`${icon} ${label} · Stream #${stream.id}`);
  return unseenChange ? `${UNSEEN_CHANGE_MARKER} ${title}` : title;
}
