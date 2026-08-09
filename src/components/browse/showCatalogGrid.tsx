'use client';

import React from 'react';
import SmallCard from '@/components/ui/smallCard';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import { useCatalogCardStyle } from '@/contexts/catalogCardStyleContext';
import type { ContentItem } from '@/types/content';
import {
  CATALOG_GRID_HORIZONTAL,
  CATALOG_GRID_VERTICAL,
} from '@/lib/catalogGrid';

type ShowCatalogGridProps = {
  items: ContentItem[];
};

export default function ShowCatalogGrid({ items }: ShowCatalogGridProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === 'horizontal';

  return (
    <div className={horizontal ? CATALOG_GRID_HORIZONTAL : CATALOG_GRID_VERTICAL}>
      {items.map((item, index) => {
        const title = item.title ?? item.name ?? 'Untitled';
        const releaseDate = item.release_date ?? item.first_air_date ?? '';
        const year = releaseDate
          ? String(new Date(releaseDate).getFullYear())
          : 'TBA';
        const id = item.id;
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
            voteAverage={item.vote_average}
            type={type}
            runtimeSeconds={item.runtimeSeconds ?? undefined}
            seasonAmount={item.season_amount ?? 0}
            numberOfEpisodes={item.number_of_episodes ?? undefined}
            posterPath={poster}
          />
        );
      })}
    </div>
  );
}
