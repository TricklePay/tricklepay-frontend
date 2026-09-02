"use client";

import { useEffect } from "react";


/**
 * Warns users before leaving a form with unsaved changes.
 * This covers browser refreshes and tab closes, which are the main
 * scenarios where a partially-completed stream form can be lost.
 */
export function useFormNavigationWarning(
  shouldWarn: boolean,
  message = "You have unsaved changes. Leaving this page will discard them.",
) {
  useEffect(() => {
    if (!shouldWarn) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [message, shouldWarn]);
}
