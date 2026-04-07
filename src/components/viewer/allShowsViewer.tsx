'use client';

import React from 'react';
import SmallCard from '../ui/smallCard';
import HorizontalCatalogCard from '../ui/horizontalCatalogCard';
import { useCatalogCardStyle } from '@/contexts/catalogCardStyleContext';
import { ContentItem } from '@/types/content';

interface AllShowsViewerProps {
  allContentData: ContentItem[];
}

function toNumericId(id: ContentItem['id']): number {
  if (typeof id === 'number' && !Number.isNaN(id)) return id;
  const n = parseInt(String(id), 10);
  return Number.isFinite(n) ? n : 0;
}

const GRID_VERTICAL =
  'grid h-full w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
/** Horizontal TV: 4 per row at lg (not 6). */
const GRID_HORIZONTAL_TV =
  'grid h-full w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4';

const AllShowsViewer: React.FC<AllShowsViewerProps> = ({ allContentData }) => {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === 'horizontal';

  return (
    <div className={horizontal ? GRID_HORIZONTAL_TV : GRID_VERTICAL}>
      {allContentData.map((item, index) => {
        const title = item.title ?? item.name ?? 'Untitled';
        const releaseDate = item.release_date ?? item.first_air_date ?? '';
        const year = releaseDate
          ? String(new Date(releaseDate).getFullYear())
          : 'TBA';
        const id = toNumericId(item.id);
        const type = item.type || 'tv';
        const poster = item.poster_path || '';

        if (horizontal) {
          return (
            <HorizontalCatalogCard
              key={`${item.id}-${index}`}
              id={id}
              title={title}
              year={year}
              type={type}
              posterPath={poster}
              backdropPath={item.backdrop_path || ''}
            />
          );
        }

        return (
          <SmallCard
            key={`${item.id}-${index}`}
            id={id}
            title={title}
            year={year}
            type={type}
            runtimeSeconds={item.runtimeSeconds ?? undefined}
            seasonAmount={item.season_amount ?? 0}
            posterPath={poster}
          />
        );
      })}
    </div>
  );
};

export default AllShowsViewer;
