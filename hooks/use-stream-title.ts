"use client";

import { useEffect, useRef, useState } from "react";

import { pageDocumentTitle, streamDocumentTitle } from "@/lib/document-title";
import type { StreamView } from "@/types/stream";

/**
 * Mirrors a stream's status into the document title so it can be read from
 * the tab strip while the page is in the background.
 *
 * When the status changes while the tab is hidden, the title also gains an
 * unseen-change marker, which is cleared once the user switches back — the
 * glyph alone would not tell them whether it was already like that when they
 * left. The previous title is restored on unmount so navigating away does not
 * leave a stale status behind.
 */
export function useStreamTitle(
  stream: Pick<StreamView, "id" | "status"> | null,
  streamId: string,
): void {
  // Last status the user could actually see, i.e. rendered while visible.
  const seenStatus = useRef<StreamView["status"] | null>(null);
  const [unseenChange, setUnseenChange] = useState(false);

  // Restore whatever title the page had before this hook took over.
  useEffect(() => {
    const previous = document.title;
    return () => {
      document.title = previous;
    };
  }, []);

  // A different stream starts from a clean slate rather than flagging the
  // navigation itself as a change.
  useEffect(() => {
    seenStatus.current = null;
    setUnseenChange(false);
  }, [stream?.id]);

  useEffect(() => {
    if (!stream) return;
    if (document.visibilityState === "visible") {
      seenStatus.current = stream.status;
    } else if (seenStatus.current !== null && seenStatus.current !== stream.status) {
      setUnseenChange(true);
    }
  }, [stream]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      setUnseenChange(false);
      if (stream) seenStatus.current = stream.status;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stream]);

  useEffect(() => {
    document.title = stream
      ? streamDocumentTitle(stream, unseenChange)
      : pageDocumentTitle(`Stream #${streamId}`);
  }, [stream, streamId, unseenChange]);
}
