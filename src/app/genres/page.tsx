"use client";

import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { IMDB_GENRES, orderGenreRowsByPreference } from "@/lib/imdbGenres";
import {
  GenreSquareTile,
  GENRE_SQUARE_GRID,
  GenreSquareTilesSkeleton,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";
import { fetchGenresIndex, peekGenresIndexCache } from "@/lib/pageDataCache";
import { MOBILE_CONTENT_INSET_LEFT } from "@/lib/contentInset";
import { useUserData } from "@/contexts/userDataContext";
import { PREFERENCES_CHANGED_EVENT } from "@/lib/userPreferences";
import { cn } from "@/lib/utils";

function mergeAllGenres(fromApi: CatalogGenreRow[]): CatalogGenreRow[] {
  const bySlug = new Map(fromApi.map((g) => [g.slug, g]));
  return IMDB_GENRES.map(({ slug, label }) => {
    const row = bySlug.get(slug);
    return row ?? { slug, name: label, count: 0, posters: [] };
  });
}

export default function GenresIndexPage() {
  const { preferences } = useUserData();
  const [genres, setGenres] = useState<CatalogGenreRow[]>(() => peekGenresIndexCache());
  const [ready, setReady] = useState(() => genres.length > 0);
  const [error, setError] = useState(false);

  const allGenres = useMemo(
    () => orderGenreRowsByPreference(mergeAllGenres(genres), preferences.genres),
    [genres, preferences.genres]
  );

  useEffect(() => {
    document.title = "Genres - Teavie";
  }, []);

  useLayoutEffect(() => {
    const cached = peekGenresIndexCache();
    if (cached.length > 0) {
      setGenres(cached);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (peekGenresIndexCache().length > 0) {
      return;
    }

    let cancelled = false;
    void fetchGenresIndex()
      .then((rows) => {
        if (cancelled) return;
        setGenres(rows);
        setError(false);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setGenres([]);
          setError(true);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      void fetchGenresIndex()
        .then((rows) => {
          setGenres(rows);
          setError(false);
        })
        .catch(() => setError(true));
    };
    window.addEventListener(PREFERENCES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, refresh);
  }, []);

  return (
    <div className="bg-background min-h-screen w-full">
      <div
        className={cn(
          MOBILE_CONTENT_INSET_LEFT,
          "w-full pb-12 pr-4 pt-2 lg:pr-24"
        )}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Genres</h1>
          <p className="mt-1 text-sm text-default-500">
            Browse movies and TV by genre.
          </p>
        </div>

        {!ready ? (
          <GenreSquareTilesSkeleton />
        ) : error ? (
          <p className="py-12 text-sm text-default-500">
            Could not load genres. Try again later.
          </p>
        ) : (
          <div className={GENRE_SQUARE_GRID}>
            {allGenres.map((genre, i) => (
              <GenreSquareTile
                key={genre.slug}
                genre={genre}
                colorClass={genreTileColor(genre.name, i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
