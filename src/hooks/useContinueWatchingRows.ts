"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  type WatchHistoryEntry,
  WATCH_HISTORY_CHANGED_EVENT,
  watchHistoryProgressLabel,
} from "@/lib/watchHistory";
import {
  fetchContinueWatchingRows,
  peekContinueWatchingRows,
  type ExploreHistoryRow,
} from "@/lib/continueWatchingRows";

function entriesKey(entries: WatchHistoryEntry[]): string {
  return entries
    .map((e) => `${e.mediaType}:${e.catalogId}:s${e.lastSeason}e${e.lastEpisode}`)
    .join("|");
}

/**
 * Load catalog cards for watch-history entries. The API is hit once per page load;
 * navigating back to a rail reuses what was already fetched, so only a hard refresh
 * pulls fresh cards.
 */
export function useContinueWatchingRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string = watchHistoryProgressLabel
) {
  const key = useMemo(() => entriesKey(entries), [entries]);
  const [rows, setRows] = useState<ExploreHistoryRow[]>([]);
  const [loading, setLoading] = useState(entries.length > 0);
  const [failed, setFailed] = useState(false);

  // Runs before paint, so a rail restored by back navigation never flashes empty.
  useLayoutEffect(() => {
    const cached = peekContinueWatchingRows(entries, progressLabel);
    if (!cached) return;
    setRows(cached);
    setLoading(false);
    setFailed(entries.length > 0 && cached.length === 0);
  }, [key, entries, progressLabel]);

  const load = useCallback(
    async (force: boolean) => {
      if (entries.length === 0) {
        setRows([]);
        setLoading(false);
        setFailed(false);
        return;
      }
      if (!force && peekContinueWatchingRows(entries, progressLabel)) return;

      setLoading(true);
      setFailed(false);
      try {
        const next = await fetchContinueWatchingRows(entries, progressLabel, {
          force,
        });
        setRows(next);
        setFailed(next.length === 0);
      } catch {
        setRows([]);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [entries, progressLabel]
  );

  const reload = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load(false);
  }, [key, load]);

  useEffect(() => {
    const onHistoryChange = () => void load(false);
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistoryChange);
    return () => window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistoryChange);
  }, [load]);

  return { rows, loading, failed, reload };
}
