"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type WatchHistoryEntry,
  WATCH_HISTORY_CHANGED_EVENT,
  watchHistoryProgressLabel,
} from "@/lib/watchHistory";
import {
  fetchContinueWatchingRows,
  type ExploreHistoryRow,
} from "@/lib/continueWatchingRows";

function entriesKey(entries: WatchHistoryEntry[]): string {
  return entries
    .map((e) => `${e.mediaType}:${e.catalogId}:s${e.lastSeason}e${e.lastEpisode}`)
    .join("|");
}

/** Load catalog cards for watch-history entries. Always refetches from the API. */
export function useContinueWatchingRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string = watchHistoryProgressLabel
) {
  const key = useMemo(() => entriesKey(entries), [entries]);
  const [rows, setRows] = useState<ExploreHistoryRow[]>([]);
  const [loading, setLoading] = useState(entries.length > 0);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (entries.length === 0) {
      setRows([]);
      setLoading(false);
      setFailed(false);
      return;
    }

    setLoading(true);
    setFailed(false);
    try {
      const next = await fetchContinueWatchingRows(entries, progressLabel);
      setRows(next);
      setFailed(next.length === 0);
    } catch {
      setRows([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [entries, progressLabel]);

  useEffect(() => {
    void reload();
  }, [key, reload]);

  useEffect(() => {
    const onHistoryChange = () => void reload();
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistoryChange);
    return () => window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistoryChange);
  }, [reload]);

  return { rows, loading, failed, reload };
}
