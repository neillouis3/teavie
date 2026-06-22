'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/ui/header';
import {
  GenreCatalogTile,
  GenreTilesSkeleton,
  genreTileColor,
  type CatalogGenreRow,
} from '@/components/genre/genreTileShared';

export default function GenresIndexPage() {
  const [genres, setGenres] = useState<CatalogGenreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      <div className="space-y-6 px-3 pb-8 pt-2 sm:px-4">
        <div className="max-w-2xl space-y-2">
          <p className="text-sm text-default-500">
            Browse by IMDb genre — labels come from each title&apos;s{' '}
            <span className="text-foreground">imdb_genres</span> catalog field (OMDb /
            AniList), not TMDB.
          </p>
          {!loading && genres.length > 0 ? (
            <p className="text-xs text-default-400">
              {genres.length} genres with catalog titles
            </p>
          ) : null}
        </div>

        {loading ? (
          <GenreTilesSkeleton />
        ) : error ? (
          <p className="py-12 text-center text-sm text-default-500">
            Could not load genres. Try again later.
          </p>
        ) : genres.length === 0 ? (
          <p className="py-12 text-center text-sm text-default-500">
            No IMDb genres in the catalog yet. Run the OMDb genre backfill scripts to
            populate <code className="text-foreground">imdb_genres</code> on titles.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {genres.map((genre, i) => (
              <GenreCatalogTile
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
