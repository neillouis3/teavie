"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import WatchLaterRail from "@/components/explore/watchLaterRail";
import FavoritesRail from "@/components/explore/favoritesRail";
import PageBlurredBackdrop from "@/components/ui/pageBlurredBackdrop";
import SmallCardLoading from "@/components/ui/smallCardLoading";
import { WATCH_LATER_CHANGED_EVENT } from "@/lib/watchLater";
import { FAVORITES_CHANGED_EVENT } from "@/lib/favorites";
import { fetchUserRailRows } from "@/lib/explorePageData";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import { LIBRARY_GRID_CLASS, RAIL_STACK_CLASS } from "@/lib/catalogGrid";
import { tmdbBackdropUrl, tmdbPosterUrl } from "@/lib/tmdbImage";
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

function libraryBackdropUrl(
  favoriteRows: ContentItem[],
  watchLaterRows: ContentItem[]
): string | null {
  for (const row of [...favoriteRows, ...watchLaterRows]) {
    const fromBackdrop = tmdbBackdropUrl(row.backdrop_path);
    if (fromBackdrop) return fromBackdrop;
    const fromPoster = tmdbPosterUrl(row.poster_path);
    if (fromPoster) return fromPoster;
  }
  return null;
}

function LibraryGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={LIBRARY_GRID_CLASS} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <SmallCardLoading key={i} />
      ))}
    </div>
  );
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
  const backdropUrl = libraryBackdropUrl(favoriteRows, watchLaterRows);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden pb-24">
      <PageBlurredBackdrop imageUrl={backdropUrl} />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 pb-12 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <header className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Library
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
            Titles you starred or saved to watch later.
          </p>
        </header>

        {isEmpty ? (
          <div className="mx-auto mt-12 flex w-full max-w-lg flex-col items-center space-y-8 text-center">
            <section className="space-y-2">
              <ExploreSectionTitle
                className="justify-center text-lg text-white"
                variant="explore"
              >
                Favorites
              </ExploreSectionTitle>
              <p className="text-sm text-white/50">
                Star movies and shows from their detail page or catalog cards.
              </p>
            </section>
            <section className="space-y-2">
              <ExploreSectionTitle
                className="justify-center text-lg text-white"
                variant="explore"
              >
                Watch later
              </ExploreSectionTitle>
              <p className="text-sm text-white/50">
                Save titles from their detail page when you want to come back.
              </p>
            </section>
            {!user ? (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
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

        {!isEmpty ? (
          <div className={`${RAIL_STACK_CLASS} mt-12 items-center`}>
            {loading && favoriteEntries.length > 0 && favoriteRows.length === 0 ? (
              <section className="flex w-full flex-col items-center gap-4" aria-busy="true">
                <ExploreSectionTitle
                  className="justify-center text-lg text-white"
                  variant="explore"
                >
                  Favorites
                </ExploreSectionTitle>
                <LibraryGridSkeleton count={4} />
              </section>
            ) : null}

            {favoriteRows.length > 0 ? (
              <FavoritesRail
                items={favoriteRows}
                layout="profile"
                bleed={false}
                display="grid"
              />
            ) : null}

            {loading && watchLaterEntries.length > 0 && watchLaterRows.length === 0 ? (
              <section className="flex w-full flex-col items-center gap-4" aria-busy="true">
                <ExploreSectionTitle
                  className="justify-center text-lg text-white"
                  variant="explore"
                >
                  Watch later
                </ExploreSectionTitle>
                <LibraryGridSkeleton count={3} />
              </section>
            ) : null}

            {watchLaterRows.length > 0 ? (
              <WatchLaterRail
                items={watchLaterRows}
                layout="profile"
                bleed={false}
                display="grid"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
