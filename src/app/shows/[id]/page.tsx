'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ShowTemplate from '@/components/showTemplate';
import CatalogDetailsSkeleton from '@/components/ui/catalogDetailsSkeleton';

function ShowPageInner() {
  const params = useParams();

  if (!params || typeof params.id !== 'string') {
    return <div>Error: Invalid show ID</div>;
  }

  return <ShowTemplate id={params.id} viewMode="details" />;
}

const ShowPage = () => (
  <Suspense fallback={<CatalogDetailsSkeleton />}>
    <ShowPageInner />
  </Suspense>
);

export default ShowPage;
