'use client';

import React from 'react';
import Header from '@/components/ui/header';
import SearchCatalogGridLoading from '@/components/browse/skeleton/searchCatalogGridLoading';

export default function SearchPageSkeleton() {
  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Search" />
      <div className="space-y-6 pr-3 pb-6 pt-6 sm:pr-4 sm:pt-8">
        <div className="h-9 w-full animate-pulse rounded-md bg-default-200" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-full animate-pulse rounded-md bg-default-200 sm:w-32"
            />
          ))}
        </div>
        <SearchCatalogGridLoading count={14} />
      </div>
    </div>
  );
}
