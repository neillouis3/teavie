'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import GenrePageTemplate from '@/components/genre/GenrePageTemplate';
import { GridSkeleton } from '@/components/genre/GenrePageSkeleton';
import {
  imdbGenreLabelFromSlug,
  isValidImdbGenreSlug,
} from '@/lib/imdbGenres.js';

function GenrePageInner() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  if (!isValidImdbGenreSlug(slug)) {
    return (
      <div className="bg-main min-h-screen w-full px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-default-500">That genre doesn&apos;t exist.</p>
        <Link href="/genres" className="mt-3 inline-block text-sm text-success hover:underline">
          Browse all genres
        </Link>
      </div>
    );
  }

  const genreLabel = imdbGenreLabelFromSlug(slug) ?? slug;
  return <GenrePageTemplate slug={slug} genreLabel={genreLabel} />;
}

export default function GenreSlugPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-main min-h-screen w-full px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="h-4 w-16 animate-pulse rounded bg-default-200" />
            <div className="h-12 w-48 animate-pulse rounded-lg bg-default-200" />
            <div className="h-16 max-w-2xl animate-pulse rounded-lg bg-default-200" />
          </div>
          <div className="mx-auto mt-10 max-w-6xl">
            <GridSkeleton />
          </div>
        </div>
      }
    >
      <GenrePageInner />
    </Suspense>
  );
}
