"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  deriveWatchedEpisodeKeys,
  formatWatchEpKey,
  loadWatchProgress,
  saveWatchProgress,
  WATCH_PROGRESS_CHANGED_EVENT,
} from "@/lib/watchProgress";
import { WATCH_HISTORY_MIN_PLAY_SECONDS } from "@/lib/watchHistory";
import {
  catalogAnimeEpisodeCount,
  tmdbSeasonsWithEpisodes,
  type Show,
} from "@/lib/showCatalogHelpers";

function watchedSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a) {
    if (!b.has(key)) return false;
  }
  return true;
}

export function useShowWatchProgress(
  id: string,
  adminKey: string | undefined,
  show: Show | null,
  loading: boolean,
  selectedSeason: number,
  selectedEpisode: number,
  setSelectedSeason: (season: number) => void,
  setSelectedEpisode: (episode: number) => void
) {
  const searchParams = useSearchParams();
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(
    () => new Set()
  );
  const [progressHydrated, setProgressHydrated] = useState(false);
  const progressAppliedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    progressAppliedForIdRef.current = null;
    setProgressHydrated(false);
  }, [id, adminKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!show || loading) return;

    const saved = loadWatchProgress(String(id));
    const urlEpRaw = searchParams.get("episode");
    const urlSeasonRaw = searchParams.get("season");
    const urlEp = urlEpRaw != null ? parseInt(urlEpRaw, 10) : NaN;
    const urlSeason = urlSeasonRaw != null ? parseInt(urlSeasonRaw, 10) : NaN;
    const cap = catalogAnimeEpisodeCount(show, id);

    if (Number.isFinite(urlEp) && urlEp >= 1) {
      const ep = cap != null ? Math.min(urlEp, cap) : urlEp;
      setSelectedSeason(
        Number.isFinite(urlSeason) && urlSeason >= 1 ? urlSeason : 1
      );
      setSelectedEpisode(ep);
    } else if (progressAppliedForIdRef.current !== id && saved) {
      const list = tmdbSeasonsWithEpisodes(show.seasons);
      const seasonObj = list.find((s) => s.season_number === saved.lastSeason);
      const max = seasonObj?.episode_count ?? 0;
      if (max > 0 && saved.lastEpisode >= 1 && saved.lastEpisode <= max) {
        setSelectedSeason(saved.lastSeason);
        setSelectedEpisode(saved.lastEpisode);
      }
    }

    if (progressAppliedForIdRef.current !== id) {
      setWatchedEpisodes(
        saved
          ? new Set(
              deriveWatchedEpisodeKeys(saved, WATCH_HISTORY_MIN_PLAY_SECONDS)
            )
          : new Set()
      );
      progressAppliedForIdRef.current = id;
      setProgressHydrated(true);
    }
  }, [
    id,
    show,
    loading,
    searchParams,
    setSelectedSeason,
    setSelectedEpisode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reloadWatched = () => {
      const saved = loadWatchProgress(String(id));
      if (!saved) return;
      const nextKeys = deriveWatchedEpisodeKeys(
        saved,
        WATCH_HISTORY_MIN_PLAY_SECONDS
      );
      setWatchedEpisodes((prev) => {
        const next = new Set(nextKeys);
        return watchedSetsEqual(prev, next) ? prev : next;
      });
    };
    window.addEventListener(WATCH_PROGRESS_CHANGED_EVENT, reloadWatched);
    window.addEventListener("storage", reloadWatched);
    return () => {
      window.removeEventListener(WATCH_PROGRESS_CHANGED_EVENT, reloadWatched);
      window.removeEventListener("storage", reloadWatched);
    };
  }, [id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!show || loading || !progressHydrated) return;

    const existing = loadWatchProgress(String(id));
    const watchedList = Array.from(watchedEpisodes).sort();
    const existingWatched = [...(existing?.watched ?? [])].sort();
    if (
      existing &&
      existing.lastSeason === selectedSeason &&
      existing.lastEpisode === selectedEpisode &&
      watchedList.length === existingWatched.length &&
      watchedList.every((key, index) => key === existingWatched[index])
    ) {
      return;
    }

    saveWatchProgress(String(id), {
      lastSeason: selectedSeason,
      lastEpisode: selectedEpisode,
      watched: Array.from(watchedEpisodes),
    });
  }, [
    id,
    show,
    loading,
    progressHydrated,
    selectedSeason,
    selectedEpisode,
    watchedEpisodes,
  ]);

  const markEpisodeWatched = useCallback((season: number, episode: number) => {
    const key = formatWatchEpKey(season, episode);
    setWatchedEpisodes((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const markEpisodeWatchedFromPlayback = useCallback(
    (season: number, episode: number, seconds: number) => {
      if (!Number.isFinite(seconds) || seconds < 1) return;
      markEpisodeWatched(season, episode);
    },
    [markEpisodeWatched]
  );

  return {
    watchedEpisodes,
    progressHydrated,
    markEpisodeWatched,
    markEpisodeWatchedFromPlayback,
  };
}
