'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ShowTemplate from '@/components/showTemplate';
import WatchPageSkeleton from '@/components/ui/watchPageSkeleton';

function ShowPageInner() {
  const params = useParams();

  if (!params || typeof params.id !== 'string') {
    return <div>Error: Invalid show ID</div>;
  }

  return <ShowTemplate id={params.id} />;
}

const ShowPage = () => (
  <Suspense fallback={<WatchPageSkeleton />}>
    <ShowPageInner />
  </Suspense>
);

export default ShowPage;
