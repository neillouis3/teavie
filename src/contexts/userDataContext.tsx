"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexts/authContext";
import {
  listWatchHistory,
  removeFromWatchHistory,
  touchWatchHistory,
  type WatchHistoryEntry,
  WATCH_HISTORY_CHANGED_EVENT,
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
  loadGuestPreferences,
  saveGuestPreferences,
  PREFERENCES_CHANGED_EVENT,
} from "@/lib/userPreferences";
import {
  hasUserPreferences,
  normalizeUserPreferences,
  type UserPreferences,
} from "@/types/user";
import {
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
  watchLaterEntries: WatchLaterEntry[];
  favoriteEntries: FavoriteEntry[];
  refreshUserData: () => Promise<void>;
  savePreferencesLocal: (preferences: UserPreferences) => void;
  removeHistoryItem: (catalogId: string) => Promise<void>;
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

function watchLaterEntriesSignature(entries: WatchLaterEntry[]): string {
  return entries.map((e) => `${e.mediaType}:${e.catalogId}`).sort().join("|");
}

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [watchHistoryEntries, setWatchHistoryEntries] = useState<WatchHistoryEntry[]>([]);
  const [watchLaterEntries, setWatchLaterEntries] = useState<WatchLaterEntry[]>([]);
  const [favoriteEntries, setFavoriteEntries] = useState<FavoriteEntry[]>([]);
  const [guestPreferences, setGuestPreferences] = useState<UserPreferences>(
    loadGuestPreferences
  );

  const preferences = useMemo(() => {
    if (user && profile) {
      return normalizeUserPreferences(profile.preferences);
    }
    return guestPreferences;
  }, [user, profile, guestPreferences]);

  const usingRemoteData = Boolean(user);
  const watchLaterSigRef = useRef("");

  const refreshUserData = useCallback(async () => {
    setWatchHistoryEntries(listWatchHistory());
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

    setGuestPreferences(loadGuestPreferences());
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshUserData();
  }, [authLoading, user?.id, refreshUserData]);

  useEffect(() => {
    const onHistory = () => {
      setWatchHistoryEntries(listWatchHistory());
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
    const onPrefs = () => {
      if (!user) setGuestPreferences(loadGuestPreferences());
    };
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistory);
    window.addEventListener(WATCH_LATER_CHANGED_EVENT, onLater);
    window.addEventListener(FAVORITES_CHANGED_EVENT, onFavorites);
    window.addEventListener(PREFERENCES_CHANGED_EVENT, onPrefs);
    window.addEventListener("storage", onHistory);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistory);
      window.removeEventListener(WATCH_LATER_CHANGED_EVENT, onLater);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, onFavorites);
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, onPrefs);
      window.removeEventListener("storage", onHistory);
    };
  }, [user]);

  const savePreferencesLocal = useCallback((prefs: UserPreferences) => {
    saveGuestPreferences(prefs);
    setGuestPreferences(prefs);
  }, []);

  const removeHistoryItem = useCallback(async (catalogId: string) => {
    removeFromWatchHistory(catalogId);
    if (user) {
      await fetch(`/api/user/watch-progress?catalogId=${encodeURIComponent(catalogId)}`, {
        method: "DELETE",
        credentials: "include",
      });
    }
    setWatchHistoryEntries(listWatchHistory());
  }, [user]);

  const syncHistoryTouch = useCallback(
    (catalogId: string, payload: Omit<WatchHistoryEntry, "catalogId" | "lastWatchedAt">) => {
      touchWatchHistory(catalogId, payload);
      setWatchHistoryEntries(listWatchHistory());
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

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const res = await fetch("/api/user/watch-progress", { credentials: "include" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        rows?: {
          catalog_id: string;
          progress?: Record<string, unknown>;
          movie_position_seconds?: number;
        }[];
      };
      for (const row of json.rows ?? []) {
        const catalogId = row.catalog_id;
        const progress = row.progress;
        if (progress && typeof progress === "object" && Object.keys(progress).length > 0) {
          const p = progress as {
            lastSeason?: number;
            lastEpisode?: number;
            watched?: string[];
            positions?: Record<string, number>;
          };
          saveWatchProgress(catalogId, {
            lastSeason: Math.max(1, Math.floor(Number(p.lastSeason)) || 1),
            lastEpisode: Math.max(1, Math.floor(Number(p.lastEpisode)) || 1),
            watched: Array.isArray(p.watched) ? p.watched : [],
            positions: p.positions,
          });
        }
        const movieSec = Math.max(0, Math.floor(Number(row.movie_position_seconds)) || 0);
        if (movieSec > 0) {
          saveMoviePlaybackPosition(catalogId, movieSec);
        }
      }
    })();
  }, [user?.id]);

  const value = useMemo(
    () => ({
      preferences,
      watchHistoryEntries,
      watchLaterEntries,
      favoriteEntries,
      refreshUserData,
      savePreferencesLocal,
      removeHistoryItem,
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
      watchLaterEntries,
      favoriteEntries,
      refreshUserData,
      savePreferencesLocal,
      removeHistoryItem,
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
