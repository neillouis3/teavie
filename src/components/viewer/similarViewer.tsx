'use client';

import React from 'react';
import SimilarCard from '@/components/similarCard';

// Define the type for each content item
type ContentItem = {
  id: number;
  title: string;
  release_year: number;
  type: string;
  runtime: number;
  season_amount?: number; // Optional, as some content might not have seasons
  poster_path: string;
};

// Define the props type for SimilarViewer
interface SimilarViewerProps {
  SimilarContent: ContentItem[]; // SimilarContent is an array of ContentItem
}

const SimilarViewer: React.FC<SimilarViewerProps> = ({ SimilarContent }) => {
  return (
    <div className="flex flex-col gap-2">
      {SimilarContent
        // Filter out any content without title or release year
        .filter((movie) => movie?.title && movie?.release_year)
        .map((movie) => (
          <SimilarCard
            key={movie.id}
            title={movie.title}
            year={String(movie.release_year)}
            type={movie.type}
            runtime={movie.runtime}
            seasonAmount={movie.season_amount ?? 0}
            id={movie.id}
            backDropPath={movie.poster_path}
          />
        ))}
    </div>
  );
};

export default SimilarViewer;
