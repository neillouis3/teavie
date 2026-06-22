'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Header from '@/components/ui/header';
import { IMDB_GENRES } from '@/lib/imdbGenres';
import {
  GenreSquareTile,
  GenreSquareTilesSkeleton,
  GENRE_SQUARE_GRID,
  genreTileColor,
  type CatalogGenreRow,
} from '@/components/genre/genreTileShared';

function mergeAllGenres(fromApi: CatalogGenreRow[]): CatalogGenreRow[] {
  const bySlug = new Map(fromApi.map((g) => [g.slug, g]));
  return IMDB_GENRES.map(({ slug, label }) => {
    const row = bySlug.get(slug);
    return row ?? { slug, name: label, count: 0, posters: [] };
  });
}

export default function GenresIndexPage() {
  const [genres, setGenres] = useState<CatalogGenreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const allGenres = useMemo(() => mergeAllGenres(genres), [genres]);

  useEffect(() => {
    document.title = 'Genres - Teavie';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch('/api/genres/popular?sort=name')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setGenres(Array.isArray(json.genres) ? json.genres : []);
      })
      .catch(() => {
        if (!cancelled) {
          setGenres([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Genres" />
      <div className="w-full px-3 pb-12 pt-2 sm:px-4">
        {loading ? (
          <GenreSquareTilesSkeleton />
        ) : error ? (
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
