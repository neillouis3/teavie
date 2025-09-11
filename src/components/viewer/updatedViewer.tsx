'use client';

import React from 'react';
import SimilarCard from '../similarCard';

// Define the type for each content item
type ContentItem = {
  id: number;
  title: string;
  release_year: number;
  type: string;
  runtime: number;
  season_amount: number;
  poster_path: string;
};

// Define the props type for UpdatedViewer
interface UpdatedViewerProps {
  updatedContent: ContentItem[]; // updatedContent is an array of ContentItem
}

const UpdatedViewer: React.FC<UpdatedViewerProps> = ({ updatedContent }) => {
  return (
    <div className="flex flex-col gap-2">
      {updatedContent && updatedContent.map((movie, index) => (
        movie && movie.title && movie.release_year ? ( // Conditionally render only if movie has title and year
          <SimilarCard 
            key={index} 
            title={movie.title} 
            year={movie.release_year}
            type={movie.type}
            runtime={movie.runtime}
            seasonAmount={movie.season_amount}
            id={movie.id}
            posterPath={movie.poster_path}
          />
        ) : null // Skip rendering if it's a placeholder (null)
      ))}
    </div>
  );
};

export default UpdatedViewer;
