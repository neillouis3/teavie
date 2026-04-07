'use client';

import React from 'react';
import CatalogCard from '../ui/catalogCard';
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

const AllShowsViewer: React.FC<AllShowsViewerProps> = ({ allContentData }) => {
  const { mode } = useCatalogCardStyle();

  return (
    <div className="grid h-full w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {allContentData.map((item, index) => {
        const title = item.title ?? item.name ?? 'Untitled';
        const releaseDate = item.release_date ?? item.first_air_date ?? '';
        const year = releaseDate
          ? String(new Date(releaseDate).getFullYear())
          : 'TBA';

        return (
          <CatalogCard
            key={item.id ?? index}
            id={toNumericId(item.id)}
            title={title}
            year={year}
            voteAverage={item.vote_average ?? null}
            runtimeSeconds={item.runtimeSeconds ?? null}
            seasonAmount={item.season_amount ?? null}
            type={item.type || 'tv'}
            posterPath={item.poster_path}
            backdropPath={item.backdrop_path}
            styleMode={mode}
          />
        );
      })}
    </div>
  );
};

export default AllShowsViewer;
