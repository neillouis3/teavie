"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useAuth } from "@/contexts/authContext";
import {
  listWatchHistoryLog,
  mergeWatchHistoryLog,
  removeFromWatchHistory,
  removeFromWatchHistoryLog,
  touchWatchHistory,
  isDismissedFromContinue,
  type WatchHistoryEntry,
  WATCH_HISTORY_LOG_CHANGED_EVENT,
  WATCH_HISTORY_MIN_PLAY_SECONDS,
  subscribeWatchHistory,
  getWatchHistorySnapshot,
  getWatchHistoryLogSnapshot,
  getEmptyWatchHistorySnapshot,
} from "@/lib/watchHistory";
import {
  addToWatchLater,
  isInWatchLater,
  listWatchLater,
  removeFromWatchLater,
  type WatchLaterEntry,
  WATCH_LATER_CHANGED_EVENT,
} from "@/lib/watchLater";
import {
  addToFavorites,
  isInFavorites,
  listFavorites,
  removeFromFavorites,
  type FavoriteEntry,
  FAVORITES_CHANGED_EVENT,
} from "@/lib/favorites";
import {
  EMPTY_USER_PREFERENCES,
  hasUserPreferences,
  normalizeUserPreferences,
  type UserPreferences,
} from "@/types/user";
import {
  loadGuestPreferences,
  PREFERENCES_CHANGED_EVENT,
} from "@/lib/userPreferences";
import {
  deriveWatchedEpisodeKeys,
  loadWatchProgress,
  saveWatchProgress,
  type WatchProgressPayload,
  setTvProgressSyncDelegate,
} from "@/lib/watchProgress";
import {
  loadMoviePlaybackPosition,
  saveMoviePlaybackPosition,
  setMovieProgressSyncDelegate,
} from "@/lib/movieWatchProgress";

type UserDataContextValue = {
  preferences: UserPreferences;
  watchHistoryEntries: WatchHistoryEntry[];
  watchHistoryLogEntries: WatchHistoryEntry[];
  watchedMovieIds: string[];
  watchLaterEntries: WatchLaterEntry[];
  favoriteEntries: FavoriteEntry[];
  refreshUserData: () => Promise<void>;
  removeHistoryItem: (catalogId: string) => Promise<void>;
  removeHistoryLogItem: (catalogId: string) => Promise<void>;
  syncHistoryTouch: (catalogId: string, payload: Omit<WatchHistoryEntry, "catalogId" | "lastWatchedAt">) => void;
  toggleWatchLater: (catalogId: string, mediaType: "movie" | "tv") => Promise<void>;
  toggleFavorite: (catalogId: string, mediaType: "movie" | "tv") => Promise<void>;
  isWatchLater: (catalogId: string) => boolean;
  isFavorite: (catalogId: string) => boolean;
  syncTvProgress: (
    catalogId: string,
    payload: Omit<WatchProgressPayload, "v">
  ) => void;
  syncMovieProgress: (catalogId: string, seconds: number) => void;
  loadTvProgress: (catalogId: string) => WatchProgressPayload | null;
  loadMovieProgress: (catalogId: string) => number;
  usingRemoteData: boolean;
};

const UserDataContext = createContext<UserDataContextValue | null>(null);

async function fetchRemoteWatchLater(): Promise<WatchLaterEntry[]> {
  const res = await fetch("/api/user/watch-later", { credentials: "include" });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    entries?: { catalogId: string; mediaType: "movie" | "tv"; addedAt: number }[];
  };
  return (json.entries ?? []).map((e) => ({
    catalogId: e.catalogId,
    mediaType: e.mediaType,
    addedAt: e.addedAt,
  }));
}

async function fetchRemoteFavorites(): Promise<FavoriteEntry[]> {
  const res = await fetch("/api/user/favorites", { credentials: "include" });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    entries?: { catalogId: string; mediaType: "movie" | "tv"; addedAt: number }[];
  };
  return (json.entries ?? []).map((e) => ({
    catalogId: e.catalogId,
    mediaType: e.mediaType,
    addedAt: e.addedAt,
  }));
}

async function fetchRemoteWatchHistory(): Promise<WatchHistoryEntry[]> {
  const res = await fetch("/api/user/watch-history", { credentials: "include" });
  if (!res.ok) return [];
  const json = (await res.json()) as { entries?: WatchHistoryEntry[] };
  return (json.entries ?? []).filter(
    (e) => e && typeof e.catalogId === "string" && e.catalogId.length > 0
  );
}

function watchLaterEntriesSignature(entries: WatchLaterEntry[]): string {
  return entries.map((e) => `${e.mediaType}:${e.catalogId}`).sort().join("|");
}

/**
 * Rebuild local history from server-side playback progress.
 * Runs after the watch-history merge so the stored media type is authoritative —
 * a progress blob alone cannot tell a movie apart from a one-season show.
 */
async function replayRemoteWatchProgress(): Promise<void> {
  const res = await fetch("/api/user/watch-progress", { credentials: "include" });
  if (!res.ok) return;
  const json = (await res.json()) as {
    rows?: {
      catalog_id: string;
      progress?: Record<string, unknown>;
      movie_position_seconds?: number;
    }[];
  };

  const known = new Map(listWatchHistoryLog().map((e) => [e.catalogId, e]));
  const historyTouches: WatchHistoryEntry[] = [];
  const now = Date.now();

  for (const row of json.rows ?? []) {
    const catalogId = String(row.catalog_id);
    if (isDismissedFromContinue(catalogId)) continue;
    const prior = known.get(catalogId);
    const progress = row.progress;

    if (
      prior?.mediaType !== "movie" &&
      progress &&
      typeof progress === "object" &&
      Object.keys(progress).length > 0
    ) {
      const p = progress as {
        lastSeason?: number;
        lastEpisode?: number;
        watched?: string[];
        positions?: Record<string, number>;
      };
      const payload = {
        lastSeason: Math.max(1, Math.floor(Number(p.lastSeason)) || 1),
        lastEpisode: Math.max(1, Math.floor(Number(p.lastEpisode)) || 1),
        watched: Array.isArray(p.watched) ? p.watched : [],
        positions: p.positions,
      };
      saveWatchProgress(catalogId, payload);
      const maxPosition = Math.max(
        0,
        ...Object.values(payload.positions ?? {}).map((value) =>
          Number.isFinite(Number(value)) ? Number(value) : 0
        )
      );
      const watchedKeys = deriveWatchedEpisodeKeys(payload, WATCH_HISTORY_MIN_PLAY_SECONDS);
      if (maxPosition >= WATCH_HISTORY_MIN_PLAY_SECONDS || watchedKeys.length > 0) {
        historyTouches.push({
          catalogId,
          mediaType: "tv",
          lastWatchedAt: prior?.lastWatchedAt ?? now,
          lastSeason: payload.lastSeason,
          lastEpisode: payload.lastEpisode,
        });
      }
    }

    const movieSec = Math.max(0, Math.floor(Number(row.movie_position_seconds)) || 0);
    if (movieSec > 0) {
      saveMoviePlaybackPosition(catalogId, movieSec, { hydrate: true });
    }
    if (movieSec >= WATCH_HISTORY_MIN_PLAY_SECONDS && prior?.mediaType !== "tv") {
      historyTouches.push({
        catalogId,
        mediaType: "movie",
        lastWatchedAt: prior?.lastWatchedAt ?? now,
        lastSeason: 1,
        lastEpisode: 1,
      });
    }
  }

  if (historyTouches.length > 0) {
    mergeWatchHistoryLog(historyTouches);
  }
}

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const watchHistoryEntries = useSyncExternalStore(
    subscribeWatchHistory,
    getWatchHistorySnapshot,
    getEmptyWatchHistorySnapshot
  );
  const watchHistoryLogEntries = useSyncExternalStore(
    subscribeWatchHistory,
    getWatchHistoryLogSnapshot,
    getEmptyWatchHistorySnapshot
  );
  const [watchLaterEntries, setWatchLaterEntries] = useState<WatchLaterEntry[]>([]);
  const [favoriteEntries, setFavoriteEntries] = useState<FavoriteEntry[]>([]);
  const [guestPreferences, setGuestPreferences] = useState<UserPreferences>(
    EMPTY_USER_PREFERENCES
  );

  const preferences = useMemo(() => {
    if (user && profile) {
      return normalizeUserPreferences(profile.preferences);
    }
    return guestPreferences;
  }, [user, profile, guestPreferences]);

  useEffect(() => {
    if (user) return;
    const syncGuestPrefs = () => setGuestPreferences(loadGuestPreferences());
    syncGuestPrefs();
    window.addEventListener(PREFERENCES_CHANGED_EVENT, syncGuestPrefs);
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, syncGuestPrefs);
  }, [user]);

  const watchedMovieIds = useMemo(
    () =>
      watchHistoryLogEntries
        .filter((e) => e.mediaType === "movie")
        .map((e) => e.catalogId),
    [watchHistoryLogEntries]
  );

  const usingRemoteData = Boolean(user);
  const watchLaterSigRef = useRef("");
  const historyHydratedRef = useRef<string | null>(null);
  const remoteHistorySyncPausedRef = useRef(false);
  const historySyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historySyncInFlightRef = useRef(false);

  const scheduleRemoteHistorySync = useCallback(() => {
    if (!user || remoteHistorySyncPausedRef.current) return;
    if (historySyncTimerRef.current) {
      clearTimeout(historySyncTimerRef.current);
    }
    historySyncTimerRef.current = setTimeout(() => {
      historySyncTimerRef.current = null;
      if (!user || remoteHistorySyncPausedRef.current || historySyncInFlightRef.current) {
        return;
      }
      const log = listWatchHistoryLog();
      if (log.length === 0) return;
      historySyncInFlightRef.current = true;
      void fetch("/api/user/watch-history", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: log }),
      })
        .catch(() => {})
        .finally(() => {
          historySyncInFlightRef.current = false;
        });
    }, 2000);
  }, [user]);

  const refreshUserData = useCallback(async () => {
    if (user) {
      const [later, favorites] = await Promise.all([
        fetchRemoteWatchLater(),
        fetchRemoteFavorites(),
      ]);

      const laterSig = watchLaterEntriesSignature(later);
      if (laterSig !== watchLaterSigRef.current) {
        watchLaterSigRef.current = laterSig;
        setWatchLaterEntries(later);
      }

      setFavoriteEntries(favorites);
      return;
    }

    setFavoriteEntries(listFavorites());

    const localLater = listWatchLater();
    const laterSig = watchLaterEntriesSignature(localLater);
    if (laterSig !== watchLaterSigRef.current) {
      watchLaterSigRef.current = laterSig;
      setWatchLaterEntries(localLater);
    }
  }, [user]);

  useLayoutEffect(() => {
    if (!user) {
      setGuestPreferences(loadGuestPreferences());
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshUserData();
  }, [authLoading, user?.id, refreshUserData]);

  useEffect(() => {
    if (!user?.id) {
      historyHydratedRef.current = null;
      return;
    }
    if (historyHydratedRef.current === user.id) return;
    historyHydratedRef.current = user.id;
    void (async () => {
      remoteHistorySyncPausedRef.current = true;
      try {
        const remote = await fetchRemoteWatchHistory();
        if (remote.length > 0) {
          mergeWatchHistoryLog(remote);
        }
        await replayRemoteWatchProgress();
      } finally {
        remoteHistorySyncPausedRef.current = false;
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    const onHistoryLog = () => {
      scheduleRemoteHistorySync();
    };
    const onLater = () => {
      if (user) {
        void fetchRemoteWatchLater().then(setWatchLaterEntries);
      } else {
        setWatchLaterEntries(listWatchLater());
      }
    };
    const onFavorites = () => {
      if (!user) setFavoriteEntries(listFavorites());
    };
    window.addEventListener(WATCH_HISTORY_LOG_CHANGED_EVENT, onHistoryLog);
    window.addEventListener(WATCH_LATER_CHANGED_EVENT, onLater);
    window.addEventListener(FAVORITES_CHANGED_EVENT, onFavorites);
    return () => {
      window.removeEventListener(WATCH_HISTORY_LOG_CHANGED_EVENT, onHistoryLog);
      window.removeEventListener(WATCH_LATER_CHANGED_EVENT, onLater);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, onFavorites);
    };
  }, [user, scheduleRemoteHistorySync]);

  useEffect(() => {
    return () => {
      if (historySyncTimerRef.current) {
        clearTimeout(historySyncTimerRef.current);
      }
    };
  }, []);

  const removeHistoryItem = useCallback(async (catalogId: string) => {
    removeFromWatchHistory(catalogId);
    if (user) {
      void fetch(`/api/user/watch-progress?catalogId=${encodeURIComponent(catalogId)}`, {
        method: "DELETE",
        credentials: "include",
      });
    }
  }, [user]);

  const removeHistoryLogItem = useCallback(async (catalogId: string) => {
    removeFromWatchHistoryLog(catalogId);
    if (user) {
      await Promise.all([
        fetch(`/api/user/watch-history?catalogId=${encodeURIComponent(catalogId)}`, {
          method: "DELETE",
          credentials: "include",
        }),
        fetch(`/api/user/watch-progress?catalogId=${encodeURIComponent(catalogId)}`, {
          method: "DELETE",
          credentials: "include",
        }),
      ]);
    }
  }, [user]);

  const syncHistoryTouch = useCallback(
    (catalogId: string, payload: Omit<WatchHistoryEntry, "catalogId" | "lastWatchedAt">) => {
      touchWatchHistory(catalogId, payload);
    },
    []
  );

  const toggleWatchLater = useCallback(
    async (catalogId: string, mediaType: "movie" | "tv") => {
      const inList = user
        ? watchLaterEntries.some((e) => e.catalogId === catalogId)
        : isInWatchLater(catalogId);

      if (user) {
        if (inList) {
          await fetch(`/api/user/watch-later?catalogId=${encodeURIComponent(catalogId)}`, {
            method: "DELETE",
            credentials: "include",
          });
          setWatchLaterEntries((prev) =>
            prev.filter((e) => e.catalogId !== catalogId)
          );
        } else {
          await fetch("/api/user/watch-later", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ catalogId, mediaType }),
          });
          setWatchLaterEntries((prev) => [
            { catalogId, mediaType, addedAt: Date.now() },
            ...prev.filter((e) => e.catalogId !== catalogId),
          ]);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(WATCH_LATER_CHANGED_EVENT));
        }
        return;
      }

      if (inList) removeFromWatchLater(catalogId);
      else addToWatchLater(catalogId, mediaType);
      setWatchLaterEntries(listWatchLater());
    },
    [user, watchLaterEntries]
  );

  const toggleFavorite = useCallback(
    async (catalogId: string, mediaType: "movie" | "tv") => {
      const id = String(catalogId);
      const inList = user
        ? favoriteEntries.some((e) => e.catalogId === id)
        : isInFavorites(id);

      if (user) {
        if (inList) {
          await fetch(`/api/user/favorites?catalogId=${encodeURIComponent(id)}`, {
            method: "DELETE",
            credentials: "include",
          });
          setFavoriteEntries((prev) => prev.filter((e) => e.catalogId !== id));
        } else {
          await fetch("/api/user/favorites", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ catalogId: id, mediaType }),
          });
          setFavoriteEntries((prev) => [
            { catalogId: id, mediaType, addedAt: Date.now() },
            ...prev.filter((e) => e.catalogId !== id),
          ]);
        }
        return;
      }

      if (inList) removeFromFavorites(id);
      else addToFavorites(id, mediaType);
      setFavoriteEntries(listFavorites());
    },
    [user, favoriteEntries]
  );

  const isFavoriteFn = useCallback(
    (catalogId: string) => {
      const id = String(catalogId);
      if (user) return favoriteEntries.some((e) => e.catalogId === id);
      return favoriteEntries.some((e) => e.catalogId === id) || isInFavorites(id);
    },
    [user, favoriteEntries]
  );

  const isWatchLaterFn = useCallback(
    (catalogId: string) => {
      if (user) return watchLaterEntries.some((e) => e.catalogId === catalogId);
      return isInWatchLater(catalogId);
    },
    [user, watchLaterEntries]
  );

  const syncTvProgress = useCallback(
    (catalogId: string, payload: Omit<WatchProgressPayload, "v">) => {
      saveWatchProgress(catalogId, payload);
    },
    []
  );

  const syncMovieProgress = useCallback((catalogId: string, seconds: number) => {
    saveMoviePlaybackPosition(catalogId, seconds);
  }, []);

  const loadTvProgress = useCallback((catalogId: string) => loadWatchProgress(catalogId), []);
  const loadMovieProgress = useCallback(
    (catalogId: string) => loadMoviePlaybackPosition(catalogId),
    []
  );

  useEffect(() => {
    setTvProgressSyncDelegate((catalogId, payload) => {
      if (!user) return;
      void fetch("/api/user/watch-progress", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ catalogId, progress: payload }),
      });
    });
    setMovieProgressSyncDelegate((catalogId, seconds) => {
      if (!user) return;
      void fetch("/api/user/watch-progress", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ catalogId, moviePositionSeconds: seconds }),
      });
    });
    return () => {
      setTvProgressSyncDelegate(null);
      setMovieProgressSyncDelegate(null);
    };
  }, [user]);

  const value = useMemo(
    () => ({
      preferences,
      watchHistoryEntries,
      watchHistoryLogEntries,
      watchedMovieIds,
      watchLaterEntries,
      favoriteEntries,
      refreshUserData,
      removeHistoryItem,
      removeHistoryLogItem,
      syncHistoryTouch,
      toggleWatchLater,
      toggleFavorite,
      isWatchLater: isWatchLaterFn,
      isFavorite: isFavoriteFn,
      syncTvProgress,
      syncMovieProgress,
      loadTvProgress,
      loadMovieProgress,
      usingRemoteData,
    }),
    [
      preferences,
      watchHistoryEntries,
      watchHistoryLogEntries,
      watchedMovieIds,
      watchLaterEntries,
      favoriteEntries,
      refreshUserData,
      removeHistoryItem,
      removeHistoryLogItem,
      syncHistoryTouch,
      toggleWatchLater,
      toggleFavorite,
      isWatchLaterFn,
      isFavoriteFn,
      syncTvProgress,
      syncMovieProgress,
      loadTvProgress,
      loadMovieProgress,
      usingRemoteData,
    ]
  );

  return (
    <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
  );
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) {
    throw new Error("useUserData must be used within UserDataProvider");
  }
  return ctx;
}

export { hasUserPreferences };
