"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  type WatchHistoryEntry,
  WATCH_HISTORY_CHANGED_EVENT,
  watchHistoryProgressLabel,
} from "@/lib/watchHistory";
import { peekExploreHistoryRows } from "@/lib/explorePageData";
import {
  fetchContinueWatchingRows,
  peekContinueWatchingRows,
  relabelRows,
  type ExploreHistoryRow,
} from "@/lib/continueWatchingRows";

function entriesKey(entries: WatchHistoryEntry[]): string {
  return entries
    .map((e) => `${e.mediaType}:${e.catalogId}:s${e.lastSeason}e${e.lastEpisode}`)
    .join("|");
}

function peekRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): ExploreHistoryRow[] | null {
  if (entries.length === 0) return [];
  const session = peekContinueWatchingRows(entries, progressLabel);
  if (session) return session;
  const day = peekExploreHistoryRows(entries, progressLabel);
  return day.length > 0 ? day : null;
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
  const [rows, setRows] = useState<ExploreHistoryRow[]>(() => peekRows(entries, progressLabel) ?? []);
  const [loading, setLoading] = useState(
    () => entries.length > 0 && !(peekRows(entries, progressLabel)?.length)
  );
  const [failed, setFailed] = useState(false);

  // Runs before paint, so dismiss/back navigation never flash stale cards.
  useLayoutEffect(() => {
    if (entries.length === 0) {
      setRows([]);
      setLoading(false);
      setFailed(false);
      return;
    }

    const cached = peekRows(entries, progressLabel);
    if (cached) {
      setRows(cached);
      setLoading(false);
      setFailed(cached.length === 0);
      return;
    }

    setRows((prev) => {
      if (prev.length === 0) return prev;
      const filtered = relabelRows(prev, entries, progressLabel);
      return filtered.length > 0 ? filtered : prev;
    });
  }, [key, entries, progressLabel]);

  const load = useCallback(
    async (force: boolean) => {
      if (entries.length === 0) {
        setRows([]);
        setLoading(false);
        setFailed(false);
        return;
      }
      if (!force && peekRows(entries, progressLabel)) return;

      if (rows.length === 0) setLoading(true);
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
    [entries, progressLabel, rows.length]
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
