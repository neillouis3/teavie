'use client';

import React from "react";
import SmallCard from "@/components/ui/smallCard";
import type { ContentItem } from "@/types/content";

type NewContentRailProps = {
  items: ContentItem[];
};

export default function NewContentRail({ items }: NewContentRailProps) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4">
      {items.slice(0, 8).map((item) => {
        const title = item.title || item.name || "Untitled";
        const rawDate = item.release_date ?? item.first_air_date ?? "";
        const year = rawDate?.split("-")[0] || "N/A";

        return (
          <SmallCard
            key={`${item.type ?? "x"}-${item.id}`}
            id={item.id}
            title={title}
            year={year}
            type={item.type || "movie"}
            runtimeSeconds={item.runtimeSeconds ?? undefined}
            seasonAmount={item.season_amount ?? 0}
            numberOfEpisodes={item.number_of_episodes ?? undefined}
            posterPath={item.poster_path || ""}
          />
        );
      })}
    </div>
  );
}
