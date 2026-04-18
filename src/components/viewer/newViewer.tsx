'use client'
import React from "react";
import SmallCard from "../ui/smallCard";
import { ContentItem } from "@/types/content";

interface NewViewerProps {
  newContent: ContentItem[];
}

export default function NewViewer({ newContent }: NewViewerProps) {
  return (
    <div className="grid w-full grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
      {newContent &&
        newContent.slice(0, 8).map((item) => {
          const title = item.title || item.name || "Untitled";
          const year =
            item.release_date?.split("-")[0] ||
            item.first_air_date?.split("-")[0] ||
            "N/A";

          return (
            <SmallCard
              key={`${item.type ?? "x"}-${item.id}`}
              id={item.id}
              title={title}
              year={year}
              type={item.type || "movie"}
              runtimeSeconds={item.runtimeSeconds ?? undefined}
              seasonAmount={item.season_amount ?? 0}
              posterPath={item.poster_path || ""}
            />
          );
        })}
    </div>
  );
}
