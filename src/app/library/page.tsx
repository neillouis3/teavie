"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import Header from "@/components/ui/header";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import WatchLaterRail from "@/components/explore/watchLaterRail";
import FavoritesRail from "@/components/explore/favoritesRail";
import { WATCH_LATER_CHANGED_EVENT } from "@/lib/watchLater";
import { FAVORITES_CHANGED_EVENT } from "@/lib/favorites";
import { fetchUserRailRows } from "@/lib/explorePageData";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import { RAIL_STACK_CLASS } from "@/lib/catalogGrid";
import { useAuth } from "@/contexts/authContext";
import { useUserData } from "@/contexts/userDataContext";
import type { ContentItem } from "@/types/content";

const LIBRARY_CACHE_PREFIX = "teavie.cache.library.v1:";

type LibraryPayload = {
  watchLaterRows: ContentItem[];
  favoriteRows: ContentItem[];
};

function listSignature(entries: { catalogId: string; mediaType: string }[]) {
  return entries.map((e) => `${e.mediaType}:${e.catalogId}`).sort().join("|");
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const { watchLaterEntries, favoriteEntries } = useUserData();

  const cacheKey = useMemo(
    () =>
      `${LIBRARY_CACHE_PREFIX}${listSignature(watchLaterEntries)}::${listSignature(favoriteEntries)}`,
    [watchLaterEntries, favoriteEntries]
  );

  const [watchLaterRows, setWatchLaterRows] = useState<ContentItem[]>(() => {
    if (typeof window === "undefined") return [];
    return readClientDayCache<LibraryPayload>(cacheKey)?.watchLaterRows ?? [];
  });
  const [favoriteRows, setFavoriteRows] = useState<ContentItem[]>(() => {
    if (typeof window === "undefined") return [];
    return readClientDayCache<LibraryPayload>(cacheKey)?.favoriteRows ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    const cached = readClientDayCache<LibraryPayload>(cacheKey);
    return !(cached && (cached.watchLaterRows.length > 0 || cached.favoriteRows.length > 0));
  });

  const loadLibrary = useCallback(async () => {
    const cached = readClientDayCache<LibraryPayload>(cacheKey);
    if (!cached?.watchLaterRows.length && !cached?.favoriteRows.length) {
      setLoading(true);
    }

    try {
      const rails = await fetchUserRailRows({
        historyEntries: [],
        watchLaterEntries: watchLaterEntries.map((e) => ({
          catalogId: e.catalogId,
          mediaType: e.mediaType,
        })),
        favoriteEntries: favoriteEntries.map((e) => ({
          catalogId: e.catalogId,
          mediaType: e.mediaType,
        })),
        progressLabel: () => "",
      });
      setWatchLaterRows(rails.watchLaterRows);
      setFavoriteRows(rails.favoriteRows);
      if (rails.watchLaterRows.length > 0 || rails.favoriteRows.length > 0) {
        writeClientDayCache(cacheKey, {
          watchLaterRows: rails.watchLaterRows,
          favoriteRows: rails.favoriteRows,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, watchLaterEntries, favoriteEntries]);

  useEffect(() => {
    document.title = "Library - Teavie";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const cached = readClientDayCache<LibraryPayload>(cacheKey);
    if (cached) {
      setWatchLaterRows(cached.watchLaterRows);
      setFavoriteRows(cached.favoriteRows);
      setLoading(false);
    }
    void loadLibrary();
  }, [authLoading, cacheKey, loadLibrary]);

  useEffect(() => {
    const onLibraryChange = () => void loadLibrary();
    window.addEventListener(WATCH_LATER_CHANGED_EVENT, onLibraryChange);
    window.addEventListener(FAVORITES_CHANGED_EVENT, onLibraryChange);
    return () => {
      window.removeEventListener(WATCH_LATER_CHANGED_EVENT, onLibraryChange);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, onLibraryChange);
    };
  }, [loadLibrary]);

  const hasWatchLater = watchLaterEntries.length > 0 || watchLaterRows.length > 0;
  const hasFavorites = favoriteEntries.length > 0 || favoriteRows.length > 0;
  const isEmpty = !loading && !hasWatchLater && !hasFavorites;

  return (
    <div className="bg-main min-h-screen w-full">
      <div className={`${CONTENT_INSET_X} pt-2`}>
        <Header pageName="Library" />
        <p className="mt-1 max-w-2xl text-sm text-default-500">
          Titles you starred or saved to watch later.
        </p>
      </div>

      {isEmpty ? (
        <div className={`mt-8 max-w-2xl space-y-6 ${CONTENT_INSET_X}`}>
          <section className="space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">
              Favorites
            </ExploreSectionTitle>
            <p className="text-sm text-default-500">
              Star movies and shows from their detail page or catalog cards.
            </p>
          </section>
          <section className="space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">
              Watch later
            </ExploreSectionTitle>
            <p className="text-sm text-default-500">
              Save titles from their detail page when you want to come back.
            </p>
          </section>
          {!user ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button as={Link} href="/login" color="success" size="sm">
                Sign in
              </Button>
              <Button as={Link} href="/signup" variant="flat" size="sm">
                Create account
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`${RAIL_STACK_CLASS} ${CONTENT_INSET_X} mt-6 pb-12`}>
        {loading && favoriteEntries.length > 0 && favoriteRows.length === 0 ? (
          <section className="max-w-2xl space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">
              Favorites
            </ExploreSectionTitle>
            <p className="text-sm text-default-500">Loading your favorites…</p>
          </section>
        ) : null}

        {favoriteRows.length > 0 ? (
          <FavoritesRail items={favoriteRows} layout="profile" />
        ) : null}

        {loading && watchLaterEntries.length > 0 && watchLaterRows.length === 0 ? (
          <section className="max-w-2xl space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">
              Watch later
            </ExploreSectionTitle>
            <p className="text-sm text-default-500">Loading watch later…</p>
          </section>
        ) : null}

        {watchLaterRows.length > 0 ? (
          <WatchLaterRail items={watchLaterRows} layout="profile" />
        ) : null}
      </div>
    </div>
  );
}
