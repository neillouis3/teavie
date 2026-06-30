'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import GenrePageTemplate from '@/components/genre/GenrePageTemplate';
import PageSplash from '@/components/ui/pageSplash';
import {
  imdbGenreLabelFromSlug,
  isValidImdbGenreSlug,
} from '@/lib/imdbGenres.js';

function GenrePageInner() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  if (!isValidImdbGenreSlug(slug)) {
    return (
      <div className="bg-main min-h-screen w-full pr-4 py-16 text-center sm:pr-6">
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
    <Suspense fallback={<PageSplash ariaLabel="Loading genre" />}>
      <GenrePageInner />
    </Suspense>
  );
}
