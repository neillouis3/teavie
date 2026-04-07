'use client';

import React from 'react';
import SimilarCard from '../similarCard';
import { ContentItem } from '@/types/content';

interface UpdatedViewerProps {
  updatedContent: ContentItem[];
}

function toNumericId(id: ContentItem["id"]): number {
  if (typeof id === "number" && !Number.isNaN(id)) return id;
  const n = parseInt(String(id), 10);
  return Number.isFinite(n) ? n : 0;
}

const UpdatedViewer: React.FC<UpdatedViewerProps> = ({ updatedContent }) => {
  return (
    <div className="flex flex-col gap-2 h-fit">
      {updatedContent &&
        updatedContent.slice(0, 9).map((movie, index) => {
          const year =
            movie.release_date?.split('-')[0] ||
            movie.first_air_date?.split('-')[0] ||
            "—";

          return movie && (movie.title || movie.name) ? (
            <SimilarCard
              key={index}
              title={movie.title || movie.name || ''}
              year={year} // pass string year
              type={movie.type || ''}
              runtimeSeconds={movie.runtimeSeconds}
              seasonAmount={movie.season_amount || 0}
              id={toNumericId(movie.id)}
              backDropPath={movie.backdrop_path || ''}
            />
          ) : null;
        })}
    </div>
  );
};

export default UpdatedViewer;
