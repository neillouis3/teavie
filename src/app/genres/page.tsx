"use client";

import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import UserPageShell from "@/components/ui/userPageShell";
import { IMDB_GENRES, orderGenreRowsByPreference } from "@/lib/imdbGenres";
import {
  GenreSquareTile,
  GENRE_SQUARE_CENTERED_GRID,
  GenreSquareTilesSkeleton,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";
import { fetchGenresIndex, peekGenresIndexCache } from "@/lib/pageDataCache";
import { useUserData } from "@/contexts/userDataContext";
import { PREFERENCES_CHANGED_EVENT } from "@/lib/userPreferences";

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
    <UserPageShell
      title="Genres"
      description="Browse movies and TV by genre."
      contentMaxWidth="6xl"
      contentClassName="flex flex-col items-center"
    >
      {!ready ? (
        <GenreSquareTilesSkeleton className={GENRE_SQUARE_CENTERED_GRID} />
      ) : error ? (
        <p className="py-12 text-center text-sm text-white/50">
          Could not load genres. Try again later.
        </p>
      ) : (
        <div className={GENRE_SQUARE_CENTERED_GRID}>
          {allGenres.map((genre, i) => (
            <GenreSquareTile
              key={genre.slug}
              genre={genre}
              colorClass={genreTileColor(genre.name, i)}
            />
          ))}
        </div>
      )}
    </UserPageShell>
  );
}
