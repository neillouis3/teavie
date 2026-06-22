'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/ui/header';
import { Chip } from '@heroui/react';
import { IMDB_GENRES, genrePageHref } from '@/lib/imdbGenres.js';

export default function GenresIndexPage() {
  useEffect(() => {
    document.title = 'Genres - Teavie';
  }, []);

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Genres" />
      <div className="space-y-4 px-3 pb-8 pt-2 sm:px-4">
        <p className="text-sm text-default-500">
          Browse by IMDb genre — the same taxonomy used for movies and TV.
        </p>
        <div className="flex flex-wrap gap-2">
          {IMDB_GENRES.map((genre) => (
            <Link key={genre.slug} href={genrePageHref(genre.slug)}>
              <Chip
                as="span"
                color="success"
                variant="flat"
                size="md"
                radius="sm"
                className="cursor-pointer transition-opacity hover:opacity-80"
              >
                {genre.label}
              </Chip>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
