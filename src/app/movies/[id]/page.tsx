'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import MovieTemplate from '@/components/movieTemplate';
import CatalogDetailsSkeleton from '@/components/ui/catalogDetailsSkeleton';

function MoviePageInner() {
  const params = useParams();

  if (!params || typeof params.id !== 'string') {
    return <div>Error: Invalid movie ID</div>;
  }

  return <MovieTemplate id={params.id} viewMode="details" />;
}

const MoviePage = () => (
  <Suspense fallback={<CatalogDetailsSkeleton />}>
    <MoviePageInner />
  </Suspense>
);

export default MoviePage;
