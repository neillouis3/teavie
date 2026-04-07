'use client';

import React from 'react';
import SmallCardLoading from '../../ui/smallCardLoading';
import HorizontalCatalogCardLoading from '../../ui/horizontalCatalogCardLoading';
import { useCatalogCardStyle } from '@/contexts/catalogCardStyleContext';

const GRID_VERTICAL =
  'grid h-full w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
const GRID_HORIZONTAL =
  'grid h-full w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
const GRID_HORIZONTAL_TV =
  'grid h-full w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4';

type AllMoviesViewerLoadingProps = {
  /** When set, uses TV horizontal grid (4 cols at lg) instead of movie horizontal (6). */
  variant?: 'movie' | 'tv';
};

export default function AllMoviesViewerLoading({
  variant = 'movie',
}: AllMoviesViewerLoadingProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === 'horizontal';
  const gridClass =
    horizontal && variant === 'tv'
      ? GRID_HORIZONTAL_TV
      : horizontal
        ? GRID_HORIZONTAL
        : GRID_VERTICAL;
  const CardSkeleton = horizontal ? HorizontalCatalogCardLoading : SmallCardLoading;

  return (
    <div className={gridClass}>
      {Array.from({ length: 18 }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}
