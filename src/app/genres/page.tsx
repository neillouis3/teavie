'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Chip } from '@heroui/react';
import Header from '@/components/ui/header';
import { IMDB_GENRES } from '@/lib/imdbGenres';
import {
  GenreSquareTile,
  GenreSquareTilesSkeleton,
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
  const withTitles = allGenres.filter((g) => g.count > 0).length;

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
      <div className="w-full space-y-4 px-3 pb-12 pt-2 sm:px-4">
        <div className="space-y-2 text-left">
          {!loading ? (
            <Chip color="success" variant="flat" size="md" radius="sm">
              {withTitles} of {allGenres.length} genres with titles
            </Chip>
          ) : null}
          <p className="text-sm leading-relaxed text-default-500 sm:text-[15px]">
            Browse movies and TV by IMDb genre — labels come from each title&apos;s{' '}
            <span className="text-foreground">imdb_genres</span> catalog field.
          </p>
        </div>

        {loading ? (
          <GenreSquareTilesSkeleton />
        ) : error ? (
          <p className="py-12 text-left text-sm text-default-500">
            Could not load genres. Try again later.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
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
