'use client';

import React from 'react';
import SmallCardLoading from '../../ui/smallCardLoading';
import HorizontalCatalogCardLoading from '../../ui/horizontalCatalogCardLoading';
import { useCatalogCardStyle } from '@/contexts/catalogCardStyleContext';
import {
  CATALOG_GRID_HORIZONTAL,
  CATALOG_GRID_VERTICAL,
} from '@/lib/catalogGrid';

export default function AllMoviesViewerLoading() {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === 'horizontal';
  const gridClass = horizontal ? CATALOG_GRID_HORIZONTAL : CATALOG_GRID_VERTICAL;
  const CardSkeleton = horizontal ? HorizontalCatalogCardLoading : SmallCardLoading;

  return (
    <div className={gridClass}>
      {Array.from({ length: 28 }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}
