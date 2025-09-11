'use client'
import React, {useEffect, useState} from "react";

import SmallCard from "../ui/smallCard";

type ContentItem = {
    id: number;
    title: string;
    release_year: number;
    type: string;
    runtime: number;
    poster_path: string;
  };
  
  // Define the props type for UpdatedViewer
  interface UpdatedViewerProps {
    allContentData: ContentItem[]; // updatedContent is an array of ContentItem
  }


const AllMovieViewer: React.FC<UpdatedViewerProps> = ({allContentData}) => {
    
    return (
        <div className="w-full h-full grid grid-cols-5 gap-4">
            {allContentData.map((movie, index) => (
                movie && movie.title && movie.release_year ? ( // Conditionally render only if movie has title and year
                <SmallCard
                    key={index} 
                     id={movie.id}
                    title={movie.title} 
                    year={movie.release_year}
                    type={movie.type}
                    runtime={movie.runtime}
                    seasonAmount={0}
                    posterPath={movie.poster_path}
                />
                ) : null // Skip rendering if it's a placeholder (null)
            ))}
        </div>
    );
};

export default AllMovieViewer;