'use client';

import React from 'react';
import SmallCardLoading from '@/components/ui/smallCardLoading';
import HorizontalCatalogCardLoading from '@/components/ui/horizontalCatalogCardLoading';
import { useCatalogCardStyle } from '@/contexts/catalogCardStyleContext';
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
} from '@/lib/catalogGrid';

type SearchCatalogGridLoadingProps = {
  count?: number;
};

export default function SearchCatalogGridLoading({
  count = 28,
}: SearchCatalogGridLoadingProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === 'horizontal';
  const gridClass = horizontal
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;
  const CardSkeleton = horizontal
    ? HorizontalCatalogCardLoading
    : SmallCardLoading;

  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}
