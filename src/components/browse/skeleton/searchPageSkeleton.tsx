'use client';

import React from 'react';
import Header from '@/components/ui/header';
import SearchCatalogGridLoading from '@/components/browse/skeleton/searchCatalogGridLoading';
import { CONTENT_INSET_X } from '@/lib/contentInset';

export default function SearchPageSkeleton() {
  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Search" />
      <div className={`space-y-6 pb-6 pt-2 ${CONTENT_INSET_X}`}>
        <div className="space-y-2">
          <div className="h-9 w-full animate-pulse rounded-md bg-default-200" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-full animate-pulse rounded-md bg-default-200 sm:w-32"
              />
            ))}
          </div>
        </div>
        <SearchCatalogGridLoading count={14} />
      </div>
    </div>
  );
}
