import { useEffect, useRef } from "react";

/**
 * Re-run a fetch when the browser tab becomes visible again while still loading.
 * Background tabs can stall network requests; this unblocks stuck page loads.
 * Does not run when `loading` is false (cached/stale content may still be shown).
 */
export function useResumeFetchWhenVisible(
  loading: boolean,
  refetch: () => void,
  bustInflight?: () => void
): void {
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    if (!loading) {
      wasHiddenRef.current = false;
      return;
    }

    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        return;
      }
      if (!wasHiddenRef.current) return;
      wasHiddenRef.current = false;
      bustInflight?.();
      refetch();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loading, refetch, bustInflight]);
}
