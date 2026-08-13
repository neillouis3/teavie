import { useEffect } from "react";

/**
 * Re-run a fetch when the browser tab becomes visible again while still loading.
 * Background tabs can stall network requests; this unblocks stuck page loads.
 */
export function useResumeFetchWhenVisible(
  loading: boolean,
  refetch: () => void,
  bustInflight?: () => void
): void {
  useEffect(() => {
    if (!loading) return;

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      bustInflight?.();
      refetch();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loading, refetch, bustInflight]);
}
