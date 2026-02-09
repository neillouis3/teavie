'use client';
import React from "react";
import SmallCard from "../ui/smallCard";
import { ContentItem } from "@/types/content";

interface AllMovieViewerProps {
  allContentData: ContentItem[];
}

const AllMovieViewer: React.FC<AllMovieViewerProps> = ({ allContentData }) => {
  return (
    <div className="w-full h-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {allContentData.map((item, index) => {
        // derive year safely
        const title = item.title ?? item.name ?? "Untitled";
        const releaseDate = item.release_date ?? item.first_air_date ?? "";
        const year = releaseDate
          ? String(new Date(releaseDate).getFullYear())
          : "TBA";

        return (
          <SmallCard
            key={item.id || index}
            id={item.id}
            title={title ?? item.name ?? "Untitled"}
            year={year}  // ✅ now a string
            type={item.type || "movie"}
            runtime={item.runtime ?? 0}
            seasonAmount={item.season_amount ?? 0}
            posterPath={item.poster_path || ""}
          />
        );
      })}
    </div>
  );
};

export default AllMovieViewer;
