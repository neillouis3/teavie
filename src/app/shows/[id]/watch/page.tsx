'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ShowTemplate from '@/components/showTemplate';
import WatchPageSkeleton from '@/components/ui/watchPageSkeleton';

function ShowWatchPageInner() {
  const params = useParams();

  if (!params || typeof params.id !== 'string') {
    return <div>Error: Invalid show ID</div>;
  }

  return <ShowTemplate id={params.id} viewMode="watch" />;
}

const ShowWatchPage = () => (
  <Suspense fallback={<WatchPageSkeleton withSeasonPicker />}>
    <ShowWatchPageInner />
  </Suspense>
);

export default ShowWatchPage;
