'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import GenrePageTemplate from '@/components/genre/GenrePageTemplate';
import { SPOTLIGHT_SKELETON_H } from '@/components/catalog/trendingHero';
import { RAIL_AFTER_SPOTLIGHT } from '@/lib/catalogGrid';
import { cn } from '@/lib/utils';
import {
  imdbGenreLabelFromSlug,
  isValidImdbGenreSlug,
} from '@/lib/imdbGenres.js';

function GenrePageInner() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  if (!isValidImdbGenreSlug(slug)) {
    return (
      <div className="bg-background min-h-screen w-full px-4 py-16 text-center lg:px-24">
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

function GenrePageFallback() {
  return (
    <div className="bg-background min-h-screen w-full">
      <section
        className={cn(
          'relative z-0 -mt-14 w-full overflow-hidden rounded-tl-2xl',
          RAIL_AFTER_SPOTLIGHT
        )}
        aria-hidden
      >
        <div
          className={cn(
            'animate-pulse bg-default-200 dark:bg-default-100/10',
            SPOTLIGHT_SKELETON_H
          )}
        />
      </section>
    </div>
  );
}

export default function GenreSlugPage() {
  return (
    <Suspense fallback={<GenrePageFallback />}>
      <GenrePageInner />
    </Suspense>
  );
}
