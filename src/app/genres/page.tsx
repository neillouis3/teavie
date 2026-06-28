"use client";

import React, { useEffect, useMemo, useState } from "react";
import Header from "@/components/ui/header";
import PageSplash from "@/components/ui/pageSplash";
import { IMDB_GENRES } from "@/lib/imdbGenres";
import {
  GenreSquareTile,
  GENRE_SQUARE_GRID,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";
import { fetchGenresIndex } from "@/lib/pageDataCache";

function mergeAllGenres(fromApi: CatalogGenreRow[]): CatalogGenreRow[] {
  const bySlug = new Map(fromApi.map((g) => [g.slug, g]));
  return IMDB_GENRES.map(({ slug, label }) => {
    const row = bySlug.get(slug);
    return row ?? { slug, name: label, count: 0, posters: [] };
  });
}

export default function GenresIndexPage() {
  const [genres, setGenres] = useState<CatalogGenreRow[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  const allGenres = useMemo(() => mergeAllGenres(genres), [genres]);

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

  if (!ready) {
    return <PageSplash ariaLabel="Loading Genres" />;
  }

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Genres" />
      <div className="w-full px-3 pb-12 pt-2 sm:px-4">
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
