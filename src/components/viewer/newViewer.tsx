'use client'
import React from "react";
import SmallCard from "../ui/smallCard";

// Define the type for the newContent items
type ContentItem = {
  id: number;
  title: string;
  release_year: number;
  type: string;
  runtime: number;
  season_amount: number;
  poster_path: string;
};

// Define the props type for NewViewer
interface NewViewerProps {
  newContent: ContentItem[]; // newContent is an array of ContentItem
}

export default function NewViewer({ newContent }: NewViewerProps) { // Use the defined type for props

  return (
    <div className="w-full h-full grid grid-cols-3 gap-4">
      {newContent && newContent.slice(0, 6).map((movie, index) => ( // Limit to 6 items
        movie && movie.title && movie.release_year ? ( // Conditionally render only if movie has title and year
          <SmallCard
            key={index} 
            id={movie.id}
            title={movie.title} 
            year={movie.release_year}
            type={movie.type}
            runtime={movie.runtime}
            seasonAmount={movie.season_amount}
            posterPath={movie.poster_path}
          />
        ) : null // Skip rendering if it's a placeholder (null)
      ))}
    </div>
  );
}
