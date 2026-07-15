'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import MovieTemplate from '@/components/movieTemplate';
import WatchPageSkeleton from '@/components/ui/watchPageSkeleton';

function MovieWatchPageInner() {
  const params = useParams();

  if (!params || typeof params.id !== 'string') {
    return <div>Error: Invalid movie ID</div>;
  }

  return <MovieTemplate id={params.id} viewMode="watch" />;
}

const MovieWatchPage = () => (
  <Suspense fallback={<WatchPageSkeleton />}>
    <MovieWatchPageInner />
  </Suspense>
);

export default MovieWatchPage;
