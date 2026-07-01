"use client";

import React, { useEffect, useMemo, useState } from "react";
import Header from "@/components/ui/header";
import PageSplash from "@/components/ui/pageSplash";
import { IMDB_GENRES, orderGenreRowsByPreference } from "@/lib/imdbGenres";
import {
  GenreSquareTile,
  GENRE_SQUARE_GRID,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";
import { fetchGenresIndex } from "@/lib/pageDataCache";
import { CONTENT_INSET_X } from "@/lib/contentInset";
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
  const [genres, setGenres] = useState<CatalogGenreRow[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  const allGenres = useMemo(
    () => orderGenreRowsByPreference(mergeAllGenres(genres), preferences.genres),
    [genres, preferences.genres]
  );

  useEffect(() => {
    document.title = "Genres - Teavie";
  }, []);

  useEffect(() => {
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

  if (!ready) {
    return <PageSplash ariaLabel="Loading Genres" />;
  }

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Genres" />
      <div className={`w-full pb-12 pt-2 ${CONTENT_INSET_X}`}>
        {error ? (
          <p className="py-12 text-left text-sm text-default-500">
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
